import { CHARACTER_NAMES } from '../cast';
import type {
  AiCounselPort,
  AngleRequest,
  AngleSuggestion,
  BalanceReport,
  CounselBrief,
  CounselDraft,
  CounselRequest,
  CourtLine,
  SentenceRequest,
} from '../ports/counsel';
import { CounselError } from '../ports/counsel';
import type { Speaker } from '../ports/court';

export interface FixtureCounselOptions {
  /** Return an unbalanced draft for the first `n` draft calls. */
  unbalancedDrafts?: number;
  /** Throw CounselError('unavailable') on every draft. */
  fail?: boolean;
  /** Artificial latency in ms (default 0). */
  latencyMs?: number;
}

const speakerFor = (b: CounselBrief): Speaker => b.counsel;

function firstSentence(text: string, max = 110): string {
  const t = text.trim().replace(/\s+/g, ' ');
  const cut = t.split(/(?<=[.!?])\s/)[0] ?? t;
  return cut.length > max ? `${cut.slice(0, max - 1)}…` : cut;
}

/**
 * Deterministic counsel for tests, demos and offline play. Records every request
 * so tests can assert the information wall, and builds a short, complete show
 * from the briefs alone. It never calls a network.
 */
export class FixtureCounsel implements AiCounselPort {
  readonly id = 'fixture' as const;
  readonly requests: CounselRequest[] = [];
  #drafts = 0;

  constructor(private readonly options: FixtureCounselOptions = {}) {}

  async #wait(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) throw new CounselError('aborted', 'Aborted');
    if (this.options.latencyMs) await new Promise((r) => setTimeout(r, this.options.latencyMs));
  }

  async suggestAngles(request: AngleRequest, signal?: AbortSignal): Promise<readonly AngleSuggestion[]> {
    await this.#wait(signal);
    const topic = firstSentence(request.story, 60).replace(/[.!?…]$/, '');
    return [
      { id: 'angle-1', text: `Market conditions made "${topic}" inevitable.` },
      { id: 'angle-2', text: 'My client was emotionally ambushed by the vibes.' },
      { id: 'angle-3', text: 'Everyone in the group chat would have done the same.' },
    ].map((a) => ({ ...a, text: a.text.slice(0, 140) }));
  }

  async draft(request: CounselRequest, signal?: AbortSignal): Promise<CounselDraft> {
    this.requests.push(request);
    await this.#wait(signal);
    if (this.options.fail) throw new CounselError('unavailable', 'Fixture counsel is set to fail', true);
    this.#drafts++;
    const unbalanced = this.#drafts <= (this.options.unbalancedDrafts ?? 0);
    const [p, d] = request.briefs;
    const [label0, label1] = request.ballot;
    let n = 0;
    const id = () => `L${String(++n).padStart(2, '0')}`;
    const lines: CourtLine[] = [
      { id: id(), speaker: 'judge', segment: 'call-to-order', beat: 'gavel', text: `Order! Court is in session. Today: "${request.title}".` },
      {
        id: id(),
        speaker: speakerFor(p),
        bench: 0,
        segment: 'opening',
        beat: 'desk-slam',
        text: `${CHARACTER_NAMES[p.counsel]} for ${label0}: ${firstSentence(p.publicText)} The facts are cooked and so is the defendant.`,
      },
      {
        id: id(),
        speaker: speakerFor(d),
        bench: 1,
        segment: 'opening',
        beat: 'smug',
        text: unbalanced
          ? 'No comment.'
          : `${CHARACTER_NAMES[d.counsel]} for ${label1}: ${d.angle ? `${d.angle} ` : ''}Context is everything, and the context is chaos.`,
      },
    ];
    if (request.scope === 'teaser') {
      lines.push({ id: id(), speaker: 'judge', segment: 'jury-out', beat: 'dramatic-pause', text: 'THE JURY IS OUT.' });
    } else {
      request.exhibits.slice(0, 2).forEach((x, i) => {
        const bench = (i % 2) as 0 | 1;
        const b = request.briefs[bench];
        lines.push({
          id: id(),
          speaker: speakerFor(b),
          bench,
          segment: 'exhibit',
          beat: 'present-evidence',
          exhibitId: x.id,
          text: `I present Exhibit ${String.fromCharCode(65 + i)}: "${x.title}". ${firstSentence(x.body, 80)}`,
        });
      });
      lines.push(
        { id: id(), speaker: speakerFor(p), bench: 0, segment: 'rebuttal', beat: 'objection', text: 'OBJECTION! That context is doing a lot of heavy lifting.' },
        { id: id(), speaker: speakerFor(d), bench: 1, segment: 'rebuttal', beat: 'point', text: unbalanced ? 'Hm.' : 'Counter! Ratio is not a personality, Miss Ratio.' },
        { id: id(), speaker: speakerFor(p), bench: 0, segment: 'closing', beat: 'point', text: `Members of the jury: vote ${label0}. Let the record show the cringe.` },
        { id: id(), speaker: speakerFor(d), bench: 1, segment: 'closing', beat: 'laugh', text: unbalanced ? 'Rest.' : `Vote ${label1}. Let bro cook.` },
        { id: id(), speaker: 'judge', segment: 'jury-out', beat: 'gavel', text: 'The jury will now seal its verdict. THE JURY IS OUT.' },
      );
    }
    const rid = (bench: number) => `fixture-${request.trialId}-${request.attempt}-${bench}`;
    const words = (b: 0 | 1) => lines.filter((l) => l.bench === b).reduce((s, l) => s + l.text.split(' ').length, 0);
    return {
      lines,
      usage: [
        { inputTokens: 400, outputTokens: words(0) * 2, requestIds: [rid(0)] },
        { inputTokens: 400, outputTokens: words(1) * 2, requestIds: [rid(1)] },
      ],
      provider: 'fixture',
      model: 'fixture-counsel-v1',
      attempt: request.attempt,
    };
  }

  async assessBalance(draft: CounselDraft): Promise<BalanceReport> {
    return assessBalanceByLength(draft);
  }

  async sentence(request: SentenceRequest): Promise<CourtLine> {
    const text =
      request.verdictLabel === 'NO VERDICT'
        ? 'MISTRIAL. The jury could not agree, so everybody gets their money back and nobody learns anything.'
        : `The jury says ${request.verdictLabel}. The court sentences everyone involved to log off for one (1) hour.`;
    return { id: 'S01', speaker: 'judge', segment: 'sentence', beat: 'gavel', text };
  }
}

/** Shared balance heuristic: compare each bench's word count; a bench under 60 % of the other fails. */
export function assessBalanceByLength(draft: CounselDraft): BalanceReport {
  const words = [0, 1].map((b) => draft.lines.filter((l) => l.bench === b).reduce((s, l) => s + l.text.split(/\s+/).length, 0)) as [number, number];
  const max = Math.max(words[0], words[1], 1);
  const scores = [words[0] / max, words[1] / max] as const;
  const ok = Math.min(...scores) >= 0.6;
  return {
    ok,
    scores,
    reasons: ok ? [] : [`Bench ${scores[0] < scores[1] ? 0 : 1} argued with ${Math.round(Math.min(...scores) * 100)} % of the other bench's words`],
  };
}

