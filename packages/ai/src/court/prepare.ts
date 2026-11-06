/**
 * Case preparation: deterministic, no inference. Turns app/developer input into
 * a PreparedCase the prompt builder can trust:
 *
 *   validate (Zod, mode-specific) -> sanitise text -> redact personal data ->
 *   safety screen (reject / gentle tone) -> numbered facts with status ->
 *   category -> ballot + advocate assignment -> input hash
 *
 * Richer understanding (the core tension, each side's best point) is written
 * by the model in the same trial call (`analysis`), so preparation costs no
 * extra inference. See docs/ai/07 §3.
 */
import { canonicalJson, keccak256 } from '@cringe-court/core';
import {
  CaseInputSchema,
  SIDE_BALLOT,
  SOLO_BALLOT,
  type Advocates,
  type CaseCategory,
  type CaseFact,
  type CourtTone,
  type ParsedCaseInput,
  type PreparedCase,
  type SoloCaseInput,
  type VersusCaseInput,
  type ViralCaseInput,
} from './schema';

export type RejectionCode = 'invalid-input' | 'unsuitable' | 'privacy' | 'insufficient-facts' | 'unresolvable';

/** A case the court will not try. `userMessage` is plain language the clerk can show. */
export class CaseRejectedError extends Error {
  constructor(
    readonly code: RejectionCode,
    readonly userMessage: string,
    readonly details: readonly string[] = [],
  ) {
    super(`${code}: ${userMessage}${details.length ? ` (${details.join('; ')})` : ''}`);
    this.name = 'CaseRejectedError';
  }
}

/* ── Text hygiene ────────────────────────────────────────────────────────── */

// Zero-width, bidi overrides and other invisible format characters used to smuggle instructions.
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
// eslint-disable-next-line no-control-regex -- deliberately strips control characters
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitize(text: string): string {
  return text.replace(INVISIBLE, '').replace(CONTROL, '').replace(/\s+/g, ' ').trim();
}

interface Redaction {
  label: string;
  re: RegExp;
}

const REDACTIONS: readonly Redaction[] = [
  { label: 'email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { label: 'link', re: /\bhttps?:\/\/\S+|\bwww\.\S+/gi },
  { label: 'wallet', re: /\b0x[a-fA-F0-9]{40}\b/g },
  { label: 'phone', re: /(?<!\w)\+?\d[\d\s().-]{7,}\d(?!\w)/g },
  { label: 'handle', re: /(?<![\w@])@[A-Za-z0-9_]{2,30}\b/g },
];

export function redact(text: string, counts: Map<string, number>): string {
  let out = text;
  for (const { label, re } of REDACTIONS) {
    out = out.replace(re, () => {
      counts.set(label, (counts.get(label) ?? 0) + 1);
      return `[${label}]`;
    });
  }
  return out;
}

/* ── Safety screening ────────────────────────────────────────────────────── */

interface Screen {
  code: RejectionCode;
  message: string;
  re: RegExp;
}

/** Cases the court refuses outright. Keyword screens are a first line, not a moderation system (docs/ai/11 §6). */
const BLOCK: readonly Screen[] = [
  { code: 'unsuitable', message: 'This sounds like it involves self-harm. The court is not the right place for it. If you are struggling, please reach out to someone you trust or a local support line.', re: /\b(suicid\w*|kill (my|him|her|them)sel(f|ves)|self[- ]harm|end my life|cutting myself)\b/i },
  { code: 'unsuitable', message: 'The court does not hear cases involving threats or violence against people.', re: /\b(kill|murder|stab|shoot|beat up|punch(ed)?|strangle|poison)\s+(him|her|them|my|his|their|the (guy|girl|man|woman|kid))\b|\bbomb\b|\bterror\w*/i },
  { code: 'unsuitable', message: 'The court does not hear cases involving abuse, stalking or coercion.', re: /\b(abus(ed|ive|ing) (me|him|her|them|my|his|their)|domestic abuse|stalk(ing|ed|er)?|groom(ing|ed)|coerc\w+|blackmail\w*|revenge porn)\b/i },
  { code: 'unsuitable', message: 'The court does not hear sexual content.', re: /\b(sex(ual|ually)?|nude|nudes|porn\w*|onlyfans|hooked up with|slept with)\b/i },
  { code: 'unsuitable', message: 'The court does not hear cases about minors in sensitive situations or about crimes.', re: /\b(underage|child porn|drug deal\w*|stole a car|arrested|felony|lawsuit|sued|restraining order)\b/i },
  { code: 'unsuitable', message: 'The court does not hear cases that attack people for who they are.', re: /\b(hate|hates|hating)\s+(all\s+)?(women|men|gays?|lesbians?|trans\w*|jews?|muslims?|christians?|hindus?|black people|white people|asians?|immigrants?|disabled people)\b/i },
  { code: 'privacy', message: 'The court will not reveal or look up anyone\'s private details.', re: /\b(home address|where (he|she|they) lives?|(his|her|their) (phone|number|address|password|location)|dox\w*|leak (his|her|their))\b/i },
  { code: 'unsuitable', message: 'Elections and candidates are outside this court\'s jurisdiction.', re: /\b(elections?|ballot box|(political|presidential|election) candidates?|campaign for president|president(ial)? race)\b/i },
];

/** Allowed, but the court lowers the comedy: jokes stay on the situation, never the hurt. */
const GENTLE: readonly RegExp[] = [
  /\b(funeral|passed away|grie(f|ving)|condolence\w*|memorial service)\b/i,
  /\b(hospital|diagnos\w+|cancer|surgery|therapy|depress\w*|anxiety|panic attack)\b/i,
  /\b(divorce|breakup|broke up|dumped|cheat(ed|ing)?|laid off|fired|lost my job|evict\w*)\b/i,
  /\b(idiot|stupid|loser|ugly|fat|disgusting|pathetic|worthless|moron|trash human)\b/i,
];

/** Instruction-like text. It stays in the case as quoted data; the prompt warns the model. */
const INJECTION: readonly RegExp[] = [
  /\bignore (all |any |the )?(previous|prior|above|earlier|your) (instructions|rules|prompts?)\b/i,
  /\b(system prompt|developer message|you are now|act as|pretend to be|jailbreak)\b/i,
  /\b(declare|announce|rule|find|say|output|print|pick|choose|vote for|favou?r)\b[^.]{0,40}\b(guilty|not cooked|winner|wins|side a|side b|verdict)\b/i,
  /<\/?\s*(case_data|system|assistant|user)\b/i,
  /```|"\s*(lines|analysis|speaker|refusal)"\s*:/i,
  /\b(add|insert|include|mention)\b[^.]{0,30}\b(evidence|screenshot|witness|receipt|source)\b/i,
];

/** Viral questions the jury cannot resolve on the arguments (future facts, unverifiable predictions). */
const UNRESOLVABLE: readonly RegExp[] = [
  /\bwill\b.*\b(next|tomorrow|this (week|month|year)|in 20\d\d|by 20\d\d)\b/i,
  /\b(price|stock|token|coin)\b.*\b(go up|go down|moon|reach|hit \$?\d)/i,
  /\bwho (will|is going to) win\b/i,
];

function screen(texts: readonly string[], flags: string[]): CourtTone {
  const all = texts.join('\n');
  for (const s of BLOCK) {
    if (s.re.test(all)) throw new CaseRejectedError(s.code, s.message);
  }
  if (INJECTION.some((re) => re.test(all))) flags.push('injection-like-text');
  if (GENTLE.some((re) => re.test(all))) {
    flags.push('gentle-tone');
    return 'gentle';
  }
  return 'standard';
}

/* ── Facts ───────────────────────────────────────────────────────────────── */

/** Split prose into sentence-sized facts; very short fragments merge into the previous one. */
export function sentences(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'([])|\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    const words = p.split(/\s+/).length;
    const last = out.length - 1;
    if (words < 4 && last >= 0) out[last] = `${out[last]} ${p}`;
    else out.push(p);
  }
  return out.map((s) => (s.length > 400 ? `${s.slice(0, 397).replace(/\s+\S*$/, '')}...` : s));
}

class FactBook {
  readonly facts: CaseFact[] = [];
  add(text: string, status: CaseFact['status'], limit: number, sourceId?: string): void {
    for (const s of sentences(text).slice(0, limit)) {
      if (this.facts.length >= 24) return;
      const fact: CaseFact = { id: `F${this.facts.length + 1}`, text: s, status };
      if (sourceId) fact.sourceId = sourceId;
      this.facts.push(fact);
    }
  }
}

/* ── Category ────────────────────────────────────────────────────────────── */

const CATEGORY_HINTS: ReadonlyArray<readonly [CaseCategory, RegExp]> = [
  ['crypto', /\b(crypto|memecoin|token|coin|nft|bitcoin|btc|eth|wallet|airdrop|blockchain|degen)\b/i],
  ['finance', /\b(invest\w*|stock|savings?|budget|loan|bank|credit card|portfolio|money|paid|bought|subscription)\b/i],
  ['dating', /\b(date|dating|crush|ex|boyfriend|girlfriend|partner|tinder|hinge|anniversary|text(ed)? back)\b/i],
  ['roommates', /\b(roommate|flatmate|housemate|landlord|dishes|fridge|thermostat)\b/i],
  ['family', /\b(mom|dad|mother|father|sister|brother|grandma|grandpa|cousin|aunt|uncle)\b/i],
  ['gaming', /\b(game|gaming|gamer|console|ranked|raid|controller|steam|speedrun|lag)\b/i],
  ['food', /\b(pizza|food|ate|eat|eating|salad|cake|cheesecake|snack|restaurant|recipe|cook(ed|ing)?|yogurt|pineapple)\b/i],
  ['fitness', /\b(gym|workout|run(ning)?|treadmill|protein|marathon|yoga|weights)\b/i],
  ['productivity', /\b(study|studying|timetable|schedule|planner|deadline|procrastinat\w*|to-do|homework|exam)\b/i],
  ['tech', /\b(laptop|monitor|keyboard|phone|app|software|computer|pc|setup|gadget|chair)\b/i],
  ['work', /\b(boss|meeting|office|coworker|colleague|email|slack|job|manager|reply-all)\b/i],
  ['internet', /\b(posted|tweet|online|reddit|tiktok|instagram|youtube|meme|group chat|comment(ed)?|liked|viral)\b/i],
  ['shopping', /\b(bought|ordered|amazon|sale|discount|shopping|cart|returned)\b/i],
  ['friendship', /\b(friend|bestie|party|birthday|hang ?out|plans)\b/i],
];

export function inferCategory(text: string, fallback: CaseCategory): CaseCategory {
  for (const [category, re] of CATEGORY_HINTS) if (re.test(text)) return category;
  return fallback;
}

/* ── Advocates ───────────────────────────────────────────────────────────── */

/** Which advocate argues Side A: a published, seeded coin flip on the case id, never the model's choice. */
export function assignAdvocates(caseId: string): Advocates {
  const flip = Number.parseInt(keccak256(`${caseId}:advocates`).slice(2, 4), 16) % 2;
  return flip === 0 ? { A: 'prosecutor', B: 'defense' } : { A: 'defense', B: 'prosecutor' };
}

/* ── Prepare ─────────────────────────────────────────────────────────────── */

export function prepareCase(raw: unknown): PreparedCase {
  const parsed = CaseInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CaseRejectedError(
      'invalid-input',
      'The clerk could not file this case: some details are missing or too long.',
      parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`),
    );
  }
  const input = parsed.data;
  const counts = new Map<string, number>();
  const clean = (s: string): string => redact(sanitize(s), counts);
  const flags: string[] = [];
  const caseId = input.caseId ?? `case_${keccak256(canonicalJson(input)).slice(2, 12)}`;

  let prepared: PreparedCase;
  switch (input.mode) {
    case 'solo':
      prepared = prepareSolo(input, caseId, clean, flags);
      break;
    case 'versus':
      prepared = prepareVersus(input, caseId, clean, flags);
      break;
    case 'viral':
      prepared = prepareViral(input, caseId, clean, flags);
      break;
  }
  for (const [label, n] of counts) prepared.flags.push(`redacted:${label}x${n}`);
  return prepared;
}

function base(input: ParsedCaseInput, caseId: string, flags: string[], tone: CourtTone, facts: CaseFact[], category: CaseCategory, title: string) {
  if (facts.length === 0) throw new CaseRejectedError('insufficient-facts', 'The court needs at least one clear sentence about what happened.');
  return {
    caseId,
    mode: input.mode,
    title,
    category,
    tone,
    facts,
    flags,
    inputHash: keccak256(canonicalJson({ mode: input.mode, title, facts })),
  };
}

function prepareSolo(input: SoloCaseInput, caseId: string, clean: (s: string) => string, flags: string[]): PreparedCase {
  const title = clean(input.caseTitle);
  const confession = clean(input.confession);
  const context = input.context ? clean(input.context) : '';
  const tone = screen([title, confession, context], flags);
  if (confession.split(/\s+/).length < 4) {
    throw new CaseRejectedError('insufficient-facts', 'Tell the court what you actually did, in at least one full sentence.');
  }
  const book = new FactBook();
  book.add(confession, 'stated', 8);
  if (context) book.add(context, 'context', 4);
  const category = input.category ?? inferCategory(`${title} ${confession} ${context}`, 'everyday');
  return {
    ...base(input, caseId, flags, tone, book.facts, category, title),
    ballot: [...SOLO_BALLOT],
    parties: { defendant: input.defendantName ? clean(input.defendantName) : 'the defendant' },
  };
}

function prepareVersus(input: VersusCaseInput, caseId: string, clean: (s: string) => string, flags: string[]): PreparedCase {
  const title = clean(input.caseTitle);
  const a = clean(input.sideA.account);
  const b = clean(input.sideB.account);
  const agreed = (input.agreedFacts ?? []).map(clean);
  const tone = screen([title, a, b, ...agreed], flags);
  const book = new FactBook();
  for (const f of agreed) book.add(f, 'agreed', 1);
  book.add(a, 'claimed-by-a', 6);
  book.add(b, 'claimed-by-b', 6);
  if (agreed.length === 0) flags.push('no-agreed-facts');
  const lenA = a.length;
  const lenB = b.length;
  if (Math.max(lenA, lenB) > 3 * Math.min(lenA, lenB)) flags.push('asymmetric-accounts');
  const category = input.category ?? inferCategory(`${title} ${a} ${b}`, 'everyday');
  return {
    ...base(input, caseId, flags, tone, book.facts, category, title),
    ballot: [...SIDE_BALLOT],
    parties: { sideA: input.sideA.name ? clean(input.sideA.name) : 'Side A', sideB: input.sideB.name ? clean(input.sideB.name) : 'Side B' },
    advocates: assignAdvocates(caseId),
  };
}

function prepareViral(input: ViralCaseInput, caseId: string, clean: (s: string) => string, flags: string[]): PreparedCase {
  const title = clean(input.caseTitle);
  // The question is shown verbatim: sanitised for invisible characters only, never rewritten.
  const question = sanitize(input.question);
  const summary = clean(input.summary);
  const posA = clean(input.sideA.position);
  const posB = clean(input.sideB.position);
  const sources = input.sources.map((s) => ({ ...s, claim: clean(s.claim), title: clean(s.title) }));
  const uncertainty = input.uncertainty.map(clean);
  const tone = screen([title, question, summary, posA, posB, ...sources.map((s) => s.claim)], flags);
  if (UNRESOLVABLE.some((re) => re.test(question))) {
    throw new CaseRejectedError('unresolvable', 'This question depends on future events or facts the jury cannot weigh. Curators need to rephrase it as a debatable question.');
  }
  const book = new FactBook();
  book.add(summary, 'background', 4);
  book.add(posA, 'position-a', 2);
  book.add(posB, 'position-b', 2);
  for (const s of sources) book.add(s.claim, s.kind === 'fact' ? 'sourced-fact' : 'sourced-opinion', 2, s.id);
  if (sources.length === 0) flags.push('no-sources');
  const category = input.category ?? 'public-debate';
  return {
    ...base(input, caseId, flags, tone, book.facts, category, title),
    ballot: [...SIDE_BALLOT],
    parties: { sideA: clean(input.sideA.label), sideB: clean(input.sideB.label) },
    advocates: assignAdvocates(caseId),
    viral: {
      question,
      positionA: posA,
      positionB: posB,
      uncertainty,
      sources: sources.map((s) => ({ id: s.id, title: s.title, ...(s.publisher ? { publisher: clean(s.publisher) } : {}), ...(s.date ? { date: s.date } : {}) })),
    },
  };
}
