/**
 * Script validation: hard failures (must be fixed or the trial is not used) and
 * soft issues (lower the heuristic quality estimate). Deterministic and cheap,
 * so it runs on every generation. The 1-5 scores here are an automated
 * *estimate* of the docs/ai/11 rubric, calibrated against human review there;
 * they are not a substitute for it.
 */
import { SLANG, STOCK_OPENERS } from './personas';
import { lengthTarget } from './prompts';
import { modelSlots, speakerFor, type ModePlan, type SlotPlan } from './plans';
import { QUALITY_DIMENSIONS, type ModelLine, type ModelScript, type PreparedCase, type QualityDimension, type ValidationIssue } from './schema';

/* ── Text helpers ────────────────────────────────────────────────────────── */

const STOP = new Set(
  'a an the and or but if then so of to in on at by for with from as is are was were be been being it its this that these those i you he she they we me my your his her their our them us not no yes do does did done have has had just very really what which who whom whose why how when where all any each some more most such than too can could would should will shall may might must there here about into over under again also only own same out up down off once because while until both few other nor per via yet ever'.split(' '),
);

export function tokens(text: string): string[] {
  return text.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s']/gu, ' ').split(/\s+/).map((t) => t.replace(/^'+|'+$/g, '')).filter(Boolean);
}

export function contentWords(text: string): string[] {
  return tokens(text).filter((t) => t.length >= 3 && !STOP.has(t));
}

/** Crude stem so "invested"/"investing"/"investment" meet. */
export const stem = (w: string): string => w.replace(/(ments?|ings?|ed|es|s|ly)$/, '').slice(0, 7);

function ngrams(words: readonly string[], n: number): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) out.add(words.slice(i, i + n).join(' '));
  return out;
}

const PII = [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, /\bhttps?:\/\/\S+|\bwww\.\S+/i, /\b0x[a-fA-F0-9]{40}\b/, /(?<!\w)\+?\d[\d\s().-]{8,}\d(?!\w)/];
const CODE_LIKE = /<\s*\/?\s*[a-z][^>]*>|\{|\}|=>|\bfunction\s*\(|javascript:|\$\{/i;

/** Verdict language that is never allowed in any line. */
const VERDICT_ANY = /\b(the verdict is|has been found (guilty|not cooked)|the jury has (decided|ruled|found|spoken)|the winner is|wins the case|won the case|case closed)\b/i;
/** Extra verdict language the neutral judge and clerk may never use. */
const VERDICT_NEUTRAL = /\b(guilty|not cooked|i (hereby )?(rule|declare)|i find (the defendant|you|him|her|them|side|in favou?r)|winner|side [ab] wins|(clearly|obviously) (right|wrong))\b/i;

/** Evidence words that must already appear in the case before a line may mention them. */
const EVIDENCE = ['screenshot', 'screenshots', 'receipt', 'receipts', 'text message', 'text messages', 'dm', 'dms', 'voicemail', 'recording', 'video clip', 'photo', 'photos', 'witness', 'witnesses', 'testimony', 'cctv', 'footage', 'chat log', 'chat logs', 'bank statement', 'email', 'emails', 'studies show', 'a study', 'survey', 'surveys', 'statistics'];
const MONEY_TERMS = ['bet', 'bets', 'betting', 'bettor', 'bettors', 'odds', 'wager', 'wagers', 'stake', 'stakes', 'staked', 'staking', 'payout', 'payouts', 'profit', 'profits', 'market', 'markets', 'prediction market', 'pool', 'usdc'];
const INSULTS = /\b(idiot|stupid|loser|ugly|fat|moron|pathetic|worthless|dumb|clown|trash human|disgusting)\b/i;
const BALLOT_CAPS = new Set(['GUILTY', 'NOT', 'COOKED', 'SIDE', 'OBJECTION']);

const hasPhrase = (text: string, phrase: string): boolean => new RegExp(`(^|[^\\p{L}])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'iu').test(text);

/* ── Validation ──────────────────────────────────────────────────────────── */

export interface CheckOptions {
  /** Characters per second used for the read-time estimate. */
  charsPerSecond?: number;
}

export interface CheckResult {
  issues: ValidationIssue[];
  scores: Record<QualityDimension, number>;
  overall: number;
}

interface Ctx {
  c: PreparedCase;
  plan: ModePlan;
  lines: Map<string, ModelLine>;
  sourceText: string;
  sourceWords: Set<string>;
  issues: ValidationIssue[];
}

function add(ctx: Ctx, code: string, severity: 'hard' | 'soft', message: string, slot?: string): void {
  ctx.issues.push({ code, severity, message, ...(slot ? { slot } : {}) });
}

export function checkScript(c: PreparedCase, plan: ModePlan, script: ModelScript, options: CheckOptions = {}): CheckResult {
  const sources = c.viral?.sources.flatMap((s) => [s.title, s.publisher, s.date]) ?? [];
  const sourceText = [c.title, ...c.facts.map((f) => f.text), c.parties.defendant, c.parties.sideA, c.parties.sideB, c.viral?.question, ...(c.viral?.uncertainty ?? []), ...sources]
    .filter(Boolean)
    .join(' \n ');
  const ctx: Ctx = {
    c,
    plan,
    lines: new Map(),
    sourceText,
    sourceWords: new Set(contentWords(sourceText).map(stem)),
    issues: [],
  };

  checkPlan(ctx, script);
  const slots = modelSlots(plan).filter((s) => ctx.lines.has(s.id));
  for (const slot of slots) checkLine(ctx, slot, ctx.lines.get(slot.id) as ModelLine);
  checkTrialLevel(ctx, slots, options);
  if (script.analysis.factRefs.length === 0) add(ctx, 'analysis-unreferenced', 'soft', 'analysis.factRefs should list the facts the analysis relies on.');

  const scores = score(ctx, slots);
  const overall = Math.round((QUALITY_DIMENSIONS.reduce((s, d) => s + scores[d], 0) / QUALITY_DIMENSIONS.length) * 100) / 100;
  return { issues: ctx.issues, scores, overall };
}

function checkPlan(ctx: Ctx, script: ModelScript): void {
  const wanted = new Map(ctx.plan.slots.map((s) => [s.id, s]));
  for (const line of script.lines) {
    const slot = wanted.get(line.slot);
    if (!slot) {
      add(ctx, 'unknown-slot', 'hard', `Slot ${line.slot} is not in the trial plan; write only ${modelSlots(ctx.plan).map((s) => s.id).join(', ')}.`, line.slot);
      continue;
    }
    if (slot.template) continue; // court-written slot: silently ignored, the template wins
    if (ctx.lines.has(line.slot)) {
      add(ctx, 'duplicate-slot', 'hard', `Slot ${line.slot} appears more than once.`, line.slot);
      continue;
    }
    ctx.lines.set(line.slot, line);
  }
  for (const slot of modelSlots(ctx.plan)) {
    if (!ctx.lines.has(slot.id)) add(ctx, 'missing-slot', 'hard', `Slot ${slot.id} (${slot.purpose.split(':')[0]}) is missing.`, slot.id);
  }
}

function checkLine(ctx: Ctx, slot: SlotPlan, line: ModelLine): void {
  const { c } = ctx;
  const text = line.text;
  const id = slot.id;
  const expected = speakerFor(slot, c);
  const counsel = expected === 'prosecutor' || expected === 'defense';
  if (line.speaker !== expected) add(ctx, 'wrong-speaker', 'hard', `${id} must be spoken by ${expected}, not ${line.speaker}.`, id);

  // Length
  if (text.length > slot.maxChars * 1.25) add(ctx, 'too-long', 'hard', `${id} is ${text.length} characters; the limit is ${slot.maxChars}.`, id);
  else if (text.length > slot.maxChars) add(ctx, 'long', 'soft', `${id} is a little long (${text.length}/${slot.maxChars}).`, id);
  if (text.length < slot.minChars * 0.5) add(ctx, 'too-short', 'hard', `${id} is too short to do its job (${text.length} characters).`, id);
  else if (text.length < slot.minChars) add(ctx, 'short', 'soft', `${id} is short (${text.length}/${slot.minChars}).`, id);

  // Safety / format
  if (PII.some((re) => re.test(text))) add(ctx, 'pii', 'hard', `${id} contains an email, link, wallet or phone number.`, id);
  if (CODE_LIKE.test(text)) add(ctx, 'code-like', 'hard', `${id} contains markup or code-like text; lines are plain dialogue.`, id);
  if (VERDICT_ANY.test(text)) add(ctx, 'verdict-leak', 'hard', `${id} announces or assumes a verdict. Only the jury decides.`, id);
  if (!counsel && VERDICT_NEUTRAL.test(text)) add(ctx, 'neutrality', 'hard', `${id}: the ${expected} must stay neutral (no guilty/winner language).`, id);
  if (INSULTS.test(text)) add(ctx, 'insult', c.tone === 'gentle' ? 'hard' : 'soft', `${id} uses an insult; roast the decision, not the person.`, id);

  // Grounding
  const lower = text.toLowerCase();
  const sourceLower = ctx.sourceText.toLowerCase();
  for (const word of EVIDENCE) {
    if (hasPhrase(lower, word) && !hasPhrase(sourceLower, word)) {
      add(ctx, 'fabricated-evidence', 'hard', `${id} mentions a ${word} that is not in the case facts. Do not invent evidence.`, id);
      break;
    }
  }
  const sourceNumbers = new Set(ctx.sourceText.match(/\d+(?:[.,]\d+)?/g) ?? []);
  const lineNumbers = text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const invented = lineNumbers.filter((n) => !sourceNumbers.has(n));
  if (invented.length) add(ctx, 'invented-number', 'hard', `${id} uses numbers not in the facts (${invented.join(', ')}).`, id);
  if (c.mode === 'viral') {
    const money = MONEY_TERMS.find((t) => hasPhrase(lower, t) && !hasPhrase(sourceLower, t));
    if (money) add(ctx, 'viral-money-talk', 'hard', `${id} mentions "${money}". The court never discusses bets, odds, stakes or markets.`, id);
  }
  if (counsel && line.factRefs.length === 0) add(ctx, 'no-fact-ref', 'soft', `${id} cites no fact ids; tie the argument to the case.`, id);
  const words = contentWords(text);
  const grounded = words.filter((w) => ctx.sourceWords.has(stem(w))).length;
  if (counsel && grounded === 0) add(ctx, 'generic-line', 'soft', `${id} shares no words with the case facts; it could be about any case.`, id);

  // Voice
  const opener = STOCK_OPENERS.find((o) => lower.startsWith(o) || lower.includes(`. ${o}`));
  if (opener) add(ctx, 'stock-opener', 'soft', `${id} uses the stock phrase "${opener}".`, id);
  const caps = (text.match(/\b[A-Z]{4,}\b/g) ?? []).filter((w) => !BALLOT_CAPS.has(w));
  if (caps.length > 2) add(ctx, 'shouting', 'soft', `${id} shouts (${caps.slice(0, 3).join(' ')}).`, id);

  // Responsiveness
  if (slot.answers) {
    const target = ctx.lines.get(slot.answers);
    if (target) checkAnswer(ctx, slot, line, target);
  }
}

function checkAnswer(ctx: Ctx, slot: SlotPlan, line: ModelLine, target: ModelLine): void {
  const id = slot.id;
  const targetStems = new Set(contentWords(target.text).map(stem));
  const overlap = contentWords(line.text).filter((w) => targetStems.has(stem(w))).length;
  if (line.answers) {
    const quoted = contentWords(line.answers);
    const hit = quoted.filter((w) => targetStems.has(stem(w))).length;
    if (quoted.length > 0 && hit / quoted.length < 0.6) {
      add(ctx, 'misquoted-answer', 'soft', `${id}.answers does not quote ${slot.answers}; quote the words being answered.`, id);
      if (overlap === 0) add(ctx, 'non-responsive', 'hard', `${id} does not engage with ${slot.answers}; answer its specific argument.`, id);
    }
  } else if (overlap === 0) {
    add(ctx, 'non-responsive', 'hard', `${id} does not engage with ${slot.answers}; answer its specific argument and quote it in "answers".`, id);
  } else {
    add(ctx, 'missing-answer-quote', 'soft', `${id} should quote the words it answers in "answers".`, id);
  }
}

function checkTrialLevel(ctx: Ctx, slots: readonly SlotPlan[], options: CheckOptions): void {
  const lines = slots.map((s) => ctx.lines.get(s.id) as ModelLine);
  const all = lines.map((l) => l.text).join(' \n ');

  // Total length
  const [lo, hi] = lengthTarget(ctx.plan, options.charsPerSecond);
  const total = lines.reduce((n, l) => n + l.text.length, 0);
  if (total > hi * 1.4) add(ctx, 'trial-too-long', 'hard', `The trial is ${total} characters; aim for ${lo}-${hi}.`);
  else if (total > hi) add(ctx, 'trial-long', 'soft', `The trial is a little long (${total}/${hi} characters).`);
  else if (total < lo * 0.7) add(ctx, 'trial-short', 'soft', `The trial is short (${total}/${lo} characters).`);

  // Voice discipline across the trial
  const objections = (all.match(/\bobjection\b/gi) ?? []).length + lines.filter((l) => l.animation === 'objection').length;
  if (objections > 3) add(ctx, 'objection-overuse', 'soft', `"Objection" is used ${objections} times; three at most, and only where it lands.`);
  const slang = SLANG.reduce((n, s) => n + (all.toLowerCase().match(new RegExp(`(^|[^\\p{L}])${s}([^\\p{L}]|$)`, 'giu')) ?? []).length, 0);
  if (slang > 3) add(ctx, 'slang-overuse', 'soft', `Meme slang appears ${slang} times; three at most.`);
  if ((all.match(/bro is cooked/gi) ?? []).length > 1) add(ctx, 'catchphrase-overuse', 'soft', '"Bro is cooked" appears more than once.');

  // Repetition. Quoting the line being answered and short callbacks are technique, not
  // repetition; copying a long run of another line (3+ shared content 4-grams) is not.
  const seen = new Map<string, string>();
  const gramsOf = lines.map((l) => ngrams(contentWords(l.text), 4));
  for (const [i, l] of lines.entries()) {
    const key = tokens(l.text).join(' ');
    const id = slots[i]?.id ?? '';
    if (seen.has(key)) add(ctx, 'duplicate-line', 'hard', `${id} repeats ${seen.get(key)} word for word.`, id);
    seen.set(key, id);
    for (let j = 0; j < i; j++) {
      const otherId = slots[j]?.id ?? '';
      if (slots[i]?.answers === otherId) continue;
      const shared = [...(gramsOf[i] ?? [])].filter((g) => gramsOf[j]?.has(g));
      if (shared.length >= 3) {
        add(ctx, 'repetition', 'soft', `${id} copies a long passage from ${otherId} ("${shared[0]}...").`, id);
        break;
      }
    }
  }

  // Invented quotes: a quoted run of 4+ words must exist in the facts or an earlier line (a callback).
  for (const [i, l] of lines.entries()) {
    const id = slots[i]?.id ?? '';
    const others = [ctx.sourceText, ...lines.filter((_, j) => j !== i).map((o) => o.text)].join(' \n ').toLowerCase();
    for (const m of l.text.matchAll(/["“]([^"”]{3,200})["”]/g)) {
      const q = tokens(m[1] ?? '').join(' ');
      if (q.split(' ').length >= 4 && !tokens(others).join(' ').includes(q)) {
        add(ctx, 'invented-quote', 'hard', `${id} quotes "${m[1]}", which nobody said in this case.`, id);
        break;
      }
    }
  }

  // Balance (two-sided modes)
  if (ctx.c.mode !== 'solo') {
    const wordsFor = (role: 'benchA' | 'benchB') => slots.filter((s) => s.role === role).reduce((n, s) => n + tokens(ctx.lines.get(s.id)?.text ?? '').length, 0);
    const a = wordsFor('benchA');
    const b = wordsFor('benchB');
    const ratio = Math.max(a, b) / Math.max(1, Math.min(a, b));
    if (ratio > 2) add(ctx, 'imbalance', 'hard', `Side A gets ${a} words and Side B ${b}; keep both sides about equal.`);
    else if (ratio > 1.4) add(ctx, 'imbalance', 'soft', `Side A gets ${a} words and Side B ${b}; keep both sides about equal.`);
  }

  // Grounding at trial level: most counsel lines must touch the facts.
  const counselSlots = slots.filter((s) => ['prosecutor', 'defense', 'benchA', 'benchB'].includes(s.role));
  const generic = ctx.issues.filter((i) => i.code === 'generic-line').length;
  if (counselSlots.length > 0 && generic > counselSlots.length / 2) add(ctx, 'ungrounded-trial', 'hard', 'Most counsel lines ignore the case facts. Argue about this specific case.');
}

/* ── Heuristic rubric estimate ───────────────────────────────────────────── */

const DIMENSION_OF: Readonly<Record<string, QualityDimension[]>> = {
  'fabricated-evidence': ['grounding'],
  'invented-number': ['grounding'],
  'invented-quote': ['grounding'],
  'no-fact-ref': ['grounding'],
  'generic-line': ['grounding', 'originality'],
  'ungrounded-trial': ['grounding'],
  'viral-money-talk': ['grounding', 'character'],
  'non-responsive': ['coherence'],
  'misquoted-answer': ['coherence'],
  'missing-answer-quote': ['coherence'],
  'duplicate-line': ['coherence', 'originality'],
  repetition: ['originality'],
  'stock-opener': ['originality', 'humor'],
  'slang-overuse': ['humor', 'character'],
  'catchphrase-overuse': ['humor', 'character'],
  'objection-overuse': ['character', 'performance'],
  shouting: ['character', 'humor'],
  'wrong-speaker': ['character'],
  neutrality: ['character'],
  'verdict-leak': ['character', 'coherence'],
  insult: ['character', 'humor'],
  'too-long': ['performance'],
  long: ['performance'],
  'too-short': ['performance'],
  short: ['performance'],
  'trial-too-long': ['performance'],
  'trial-long': ['performance'],
  'trial-short': ['performance'],
  'missing-slot': ['coherence', 'performance'],
  'unknown-slot': ['performance'],
  'duplicate-slot': ['performance'],
  pii: ['grounding'],
  'code-like': ['performance'],
  imbalance: ['prosecution', 'defense'],
  'analysis-unreferenced': ['grounding'],
};

function score(ctx: Ctx, slots: readonly SlotPlan[]): Record<QualityDimension, number> {
  const s = Object.fromEntries(QUALITY_DIMENSIONS.map((d) => [d, 5])) as Record<QualityDimension, number>;
  for (const issue of ctx.issues) {
    for (const d of DIMENSION_OF[issue.code] ?? []) s[d] -= issue.severity === 'hard' ? 1.5 : 0.5;
  }
  // Per-bench quality: counsel lines that are grounded and of useful length.
  const benchScore = (roles: readonly string[]) => {
    const mine = slots.filter((x) => roles.includes(x.role));
    const weak = ctx.issues.filter((i) => i.slot && mine.some((m) => m.id === i.slot) && ['generic-line', 'no-fact-ref', 'short', 'too-short', 'non-responsive', 'wrong-speaker'].includes(i.code)).length;
    return weak * 0.75;
  };
  s.prosecution -= benchScore(ctx.c.mode === 'solo' ? ['prosecutor'] : ['benchA']);
  s.defense -= benchScore(ctx.c.mode === 'solo' ? ['defense'] : ['benchB']);
  // Humor proxy: callbacks (a later counsel line reusing a distinctive earlier phrase) and expressive staging.
  const lines = slots.map((x) => ctx.lines.get(x.id) as ModelLine);
  const early = new Set(lines.slice(0, Math.ceil(lines.length / 2)).flatMap((l) => contentWords(l.text).filter((w) => w.length >= 5)));
  const callbacks = lines.slice(Math.ceil(lines.length / 2)).some((l) => contentWords(l.text).some((w) => early.has(w) && !ctx.sourceWords.has(stem(w))));
  if (!callbacks) s.humor -= 0.5;
  const emotions = new Set(lines.map((l) => l.emotion));
  if (emotions.size < 3) s.performance -= 0.5;
  for (const d of QUALITY_DIMENSIONS) s[d] = Math.max(1, Math.min(5, Math.round(s[d] * 100) / 100));
  return s;
}

/** Validation for commentary text against the external result. */
export function checkCommentary(
  text: { announcement: string; quip: string; prosecutorReaction?: string | undefined; defenseReaction?: string | undefined },
  required: string,
  marketSettled: boolean | undefined,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const phrases = ['GUILTY', 'NOT COOKED', 'SIDE A', 'SIDE B', 'NO VERDICT'];
  const upper = text.announcement.toUpperCase();
  if (!upper.includes(required)) issues.push({ code: 'missing-outcome', severity: 'hard', message: `The announcement must contain "${required}".` });
  // "NOT COOKED" contains no other phrase; "GUILTY" must not appear in a NOT COOKED announcement, etc.
  const stripped = upper.split(required).join(' ');
  const other = phrases.find((p) => p !== required && stripped.includes(p));
  if (other) issues.push({ code: 'conflicting-outcome', severity: 'hard', message: `The announcement mentions "${other}", which is not the result.` });
  const all = [text.announcement, text.quip, text.prosecutorReaction ?? '', text.defenseReaction ?? ''].join(' ');
  if (['NO VERDICT', 'CANCELLED', 'INVALID'].includes(required) && /\b(wins?|won|winner|loses|lost the case|victory|guilty|not cooked)\b/i.test(all)) {
    issues.push({ code: 'invented-winner', severity: 'hard', message: 'Nobody won this case; do not name a winner or loser.' });
  }
  if (!marketSettled && /\b(payouts?|profits?|paid out|winnings|settled|odds|bets?|stakes?)\b/i.test(all)) {
    issues.push({ code: 'money-claim', severity: 'hard', message: 'Do not mention payouts, bets or settlement.' });
  }
  if (PII.some((re) => re.test(all)) || CODE_LIKE.test(all)) issues.push({ code: 'unsafe-text', severity: 'hard', message: 'Commentary contains contact details, links or code.' });
  if (INSULTS.test(all)) issues.push({ code: 'insult', severity: 'hard', message: 'Commentary insults someone.' });
  return issues;
}
