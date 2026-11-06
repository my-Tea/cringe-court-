/**
 * Offline Versus counsel: a deterministic AiCounselPort for tests, demos and the
 * offline build. The 0G Compute adapter replaces it behind the same port.
 *
 * It writes a Versus-shaped show: Agent A (Side A, prosecution bench) opens,
 * Agent B (Side B, defense bench) answers, exhibits, rebuttals that quote the
 * other side's *public* story, closings, then THE JURY IS OUT. It follows the
 * port's fairness contract:
 * - each bench is written only from its own brief plus public text (D1); a
 *   side's private notes shape tone but are never quoted (they are not public);
 * - both benches get the same structure and budget;
 * - a redraft of one bench (`request.redraft`) keeps the other bench's lines
 *   verbatim from `request.carryOver`;
 * - the AI never decides: `sentence()` only flavours the human verdict.
 */
import {
  CounselError,
  seededRandom,
  type AiCounselPort,
  type AngleRequest,
  type AngleSuggestion,
  type BalanceReport,
  type CounselBrief,
  type CounselDraft,
  type CounselRequest,
  type CourtLine,
  type SentenceRequest,
} from '@cringe-court/core';
import { assessBalanceByLength } from '@cringe-court/core/testing';

export interface VersusCounselOptions {
  /** Artificial latency per call in ms (default 0). The demo uses ~1.2 s so drafting feels real. */
  latencyMs?: number;
  /** Return a lopsided draft for the first `n` draft calls (tests the D1 balance gate). */
  unbalancedDrafts?: number;
  /** Throw CounselError('unavailable') on every draft. */
  fail?: boolean;
}

function clean(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function sentences(text: string): string[] {
  return clean(text)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function clip(text: string, max: number): string {
  const t = clean(text);
  return t.length > max ? `${t.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : t;
}

/** A quoted sentence keeps its own end punctuation inside the quotes ("cold." not "cold.".). */
function quoted(text: string): string {
  return `“${/[.!?…]$/.test(text) ? text : `${text}.`}”`;
}

/** The same quote mid-sentence: no end punctuation to collide with what follows. */
function quotedInline(text: string): string {
  return `“${text.replace(/[.!?…]+$/, '')}”`;
}

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length) % items.length]!;
}

const OPENERS = [
  'Members of the jury, this is not complicated.',
  'Ladies, gentlemen and verified humans of the jury.',
  'Your Honor, my client has been patient. Today that ends.',
  'Jury, put your phones down. This one matters.',
];

const REBUTTALS_A = ['OBJECTION! That story is doing a lot of heavy lifting.', 'OBJECTION! The other side calls that context. I call it an alibi.', 'OBJECTION! Speculation, vibes and a suspicious amount of confidence.'];
const REBUTTALS_B = ['Counter! Agent A wants you to forget half the story.', 'Counter! Ratio is not an argument, Agent A.', 'Counter! The prosecution bench is cooking with no ingredients.'];

const CLOSERS = ['Vote with your conscience. Your conscience says {label}.', 'The receipts are in. Vote {label}.', 'Do the right thing. Do the {label} thing.', 'Let bro cook. Vote {label}.'];

const PRIVATE_HINTS = [
  'My client told me things I will not repeat in open court. Trust me: they help.',
  'There is context here I am not allowed to share, and it is on our side.',
];

const NO_NOTES = ['We have nothing to hide and nothing to add. The facts do the talking.', 'No secrets, no spin. Just the story.'];

function benchText(b: CounselBrief, label: string, rand: () => number, unbalanced: boolean) {
  const story = sentences(b.publicText);
  const lead = story[0] ?? 'Our story speaks for itself.';
  const point = story[1] ?? story[0] ?? lead;
  const agent = b.counsel === 'side-a' ? 'Agent A' : b.counsel === 'side-b' ? 'Agent B' : 'Counsel';
  const who = b.nickname ? `Side ${b.client?.toUpperCase() ?? ''} — “${b.nickname}”` : `Side ${b.client?.toUpperCase() ?? ''}`;
  if (unbalanced) {
    return { opening: 'No comment.', angle: 'Hm.', notes: '…', closing: 'Rest.', who, agent };
  }
  return {
    opening: `${agent} for ${who}. ${pick(rand, OPENERS)} ${clip(lead, 180)}`,
    angle: b.angle ? `Our position, in one line: ${clip(b.angle, 140)} ${clip(point, 140)}` : clip(point, 200),
    notes: b.privateNotes ? pick(rand, PRIVATE_HINTS) : pick(rand, NO_NOTES),
    closing: pick(rand, CLOSERS).replace('{label}', label),
    who,
    agent,
  };
}

export class VersusCounsel implements AiCounselPort {
  readonly id = 'fixture' as const;
  /** Every draft request, so tests can assert the information wall. */
  readonly requests: CounselRequest[] = [];
  #drafts = 0;

  constructor(private readonly options: VersusCounselOptions = {}) {}

  async #wait(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) throw new CounselError('aborted', 'Aborted');
    if (this.options.latencyMs) await new Promise((r) => setTimeout(r, this.options.latencyMs));
    if (signal?.aborted) throw new CounselError('aborted', 'Aborted');
  }

  async suggestAngles(request: AngleRequest, signal?: AbortSignal): Promise<readonly AngleSuggestion[]> {
    await this.#wait(signal);
    const first = sentences(request.story)[0] ?? 'this';
    // Single curly quotes: the angle is shown inside double quotes, so no nesting.
    const topic = clip(first.replace(/[.!?…]+$/, '').replace(/[“”"]/g, ''), 60);
    const rand = seededRandom(`angles:${request.trialId}:${request.story.length}`);
    const pool = [
      `A deal is a deal, and ‘${topic}’ broke it.`,
      'Intent matters more than outcome, and my intent was pure.',
      'Any reasonable person in the group chat would have done the same.',
      'The other side is arguing vibes. I am arguing facts.',
      'This was not a crime. It was a learning opportunity, for them.',
      'Consistency: I have never once done what they do every week.',
    ];
    const out: AngleSuggestion[] = [];
    const used = new Set<number>([0]);
    out.push({ id: 'angle-1', text: clip(pool[0]!, 140) });
    while (out.length < 3) {
      const i = 1 + Math.floor(rand() * (pool.length - 1));
      if (used.has(i)) continue;
      used.add(i);
      out.push({ id: `angle-${out.length + 1}`, text: clip(pool[i]!, 140) });
    }
    return out;
  }

  async draft(request: CounselRequest, signal?: AbortSignal): Promise<CounselDraft> {
    this.requests.push(request);
    await this.#wait(signal);
    if (this.options.fail) throw new CounselError('unavailable', 'The offline counsel is set to fail', true);
    this.#drafts++;
    const unbalanced = this.#drafts <= (this.options.unbalancedDrafts ?? 0);
    const [ba, bb] = request.briefs;
    const [label0, label1] = request.ballot;
    const ra = seededRandom(`${request.trialId}:0:${request.attempt}`);
    const rb = seededRandom(`${request.trialId}:1:${request.attempt}`);
    const A = benchText(ba, label0, ra, false);
    const B = benchText(bb, label1, rb, unbalanced);
    const quoteB = clip(sentences(bb.publicText)[0] ?? 'nothing', 90);
    const quoteA = clip(sentences(ba.publicText)[0] ?? 'nothing', 90);

    let n = 0;
    const id = () => `L${String(++n).padStart(2, '0')}`;
    const lines: CourtLine[] = [
      { id: id(), speaker: 'judge', segment: 'call-to-order', beat: 'gavel', text: `Order! Versus Court is in session: “${clip(request.title, 80)}”. Side A against Side B. Agents, you may cook.` },
      { id: id(), speaker: 'side-a', bench: 0, segment: 'opening', beat: 'desk-slam', text: A.opening },
      { id: id(), speaker: 'side-a', bench: 0, segment: 'opening', beat: 'point', text: A.angle },
      { id: id(), speaker: 'side-b', bench: 1, segment: 'opening', beat: 'smug', text: B.opening },
      { id: id(), speaker: 'side-b', bench: 1, segment: 'opening', beat: 'point', text: B.angle },
    ];
    if (request.scope === 'teaser') {
      lines.push({ id: id(), speaker: 'judge', segment: 'jury-out', beat: 'dramatic-pause', text: 'THE JURY IS OUT.' });
    } else {
      const bySide = (side: 'a' | 'b') => request.exhibits.filter((x) => x.submittedBy === side).slice(0, 2);
      const exA = bySide('a');
      const exB = bySide('b');
      const rounds = Math.max(exA.length, exB.length);
      let letter = 0;
      for (let i = 0; i < rounds; i++) {
        for (const [bench, list, speaker] of [[0, exA, 'side-a'], [1, exB, 'side-b']] as const) {
          const x = list[i];
          if (!x) continue;
          const body = unbalanced && bench === 1 ? '' : ` ${clip(x.body, 120)}`;
          lines.push({
            id: id(),
            speaker,
            bench,
            segment: 'exhibit',
            beat: 'present-evidence',
            exhibitId: x.id,
            text: `I present Exhibit ${String.fromCharCode(65 + letter++)}: “${clip(x.title, 60)}”.${body}`,
          });
        }
      }
      lines.push(
        { id: id(), speaker: 'side-a', bench: 0, segment: 'rebuttal', beat: 'objection', text: `${pick(ra, REBUTTALS_A)} Side B says ${quoted(quoteB)} Listen to that again.` },
        { id: id(), speaker: 'side-b', bench: 1, segment: 'rebuttal', beat: 'objection', text: unbalanced ? 'Hm.' : `${pick(rb, REBUTTALS_B)} ${quotedInline(quoteA)} is not the whole story, and they know it.` },
        { id: id(), speaker: 'judge', segment: 'rebuttal', beat: 'dramatic-pause', text: 'The court notes that both sides arrived with receipts. Continue.' },
        { id: id(), speaker: 'side-a', bench: 0, segment: 'closing', beat: 'point', text: `${A.notes} ${A.closing}` },
        { id: id(), speaker: 'side-b', bench: 1, segment: 'closing', beat: 'laugh', text: unbalanced ? B.closing : `${B.notes} ${B.closing}` },
        { id: id(), speaker: 'judge', segment: 'jury-out', beat: 'gavel', text: 'Jurors: seal your Secret Verdict Scrolls. THE JURY IS OUT.' },
      );
    }

    // A one-bench redraft keeps the other bench word for word (D2: the other side's approved text never moves).
    if (request.redraft !== undefined && request.carryOver?.length) {
      const keep = request.redraft === 0 ? 1 : 0;
      const prior = new Map(request.carryOver.filter((l) => l.bench === keep).map((l) => [l.id, l]));
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const old = line.bench === keep ? prior.get(line.id) : undefined;
        if (old) lines[i] = old;
      }
    }

    const words = (b: 0 | 1) => lines.filter((l) => l.bench === b).reduce((s, l) => s + l.text.split(/\s+/).length, 0);
    const rid = (bench: number) => `offline-${request.trialId}-${request.attempt}-${bench}`;
    return {
      lines,
      usage: [
        { inputTokens: Math.min(request.budget.maxInputTokens, 600 + ba.publicText.length), outputTokens: Math.min(request.budget.maxOutputTokens, words(0) * 2), requestIds: [rid(0)] },
        { inputTokens: Math.min(request.budget.maxInputTokens, 600 + bb.publicText.length), outputTokens: Math.min(request.budget.maxOutputTokens, words(1) * 2), requestIds: [rid(1)] },
      ],
      provider: 'fixture',
      model: 'versus-offline-counsel-v1',
      attempt: request.attempt,
    };
  }

  async assessBalance(draft: CounselDraft): Promise<BalanceReport> {
    return assessBalanceByLength(draft);
  }

  async sentence(request: SentenceRequest, signal?: AbortSignal): Promise<CourtLine> {
    await this.#wait(signal);
    const label = request.verdictLabel;
    let text: string;
    if (label === 'NO VERDICT') {
      text = 'MISTRIAL. No verdict was reached, so both sides get their money back and the argument continues at dinner.';
    } else {
      const loser = label.startsWith('SIDE A') ? 'Side B' : 'Side A';
      text = `The jury finds for ${label}. ${loser} is sentenced to admit it in the group chat within the hour. Court is adjourned.`;
    }
    return { id: 'S01', speaker: 'judge', segment: 'sentence', beat: 'gavel', text };
  }
}
