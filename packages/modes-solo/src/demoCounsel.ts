/**
 * DemoCounsel: a scripted AiCounselPort for the testnet demo and offline play.
 * It writes a complete, funny, *balanced* Solo show from the public story, the
 * user's angle and the exhibits, without any network call. Production uses the
 * 0G Compute adapter behind the same port; the UI labels demo transcripts as
 * "scripted demo counsel".
 *
 * It keeps every port promise: Miss Ratio's lines use only public text, private
 * notes never appear in any line, both benches get matching length, and the
 * judge's sentence only flavours a verdict the jury already recorded.
 */
import {
  CounselError,
  keccak256,
  type AiCounselPort,
  type AngleRequest,
  type AngleSuggestion,
  type BalanceReport,
  type Category,
  type CounselDraft,
  type CounselRequest,
  type CourtLine,
  type SentenceRequest,
} from '@cringe-court/core';
import { assessBalanceByLength } from '@cringe-court/core/testing';

export interface DemoCounselOptions {
  /** Simulated inference latency (ms), so loading states are real. */
  latencyMs?: number;
}

function pick<T>(items: readonly T[], seed: string): T {
  const n = parseInt(keccak256(seed).slice(2, 10), 16);
  return items[n % items.length]!;
}

function gist(text: string, max = 96): string {
  const t = text.replace(/\s+/g, ' ').trim();
  const first = t.split(/(?<=[.!?])\s/)[0] ?? t;
  const cut = first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
  return cut.replace(/[.!?]$/, '');
}

const ANGLES: Readonly<Record<Category, readonly string[]>> = {
  'crypto-crimes': ['Market conditions made it inevitable. Nobody can time the top.', 'It was a long-term position held for a very short term.', 'My client was doing on-chain research. Expensive research.'],
  'dating-crimes': ['My client was emotionally ambushed by the vibes.', 'Choosing the right emoji takes time. Three weeks is thorough.', 'Mercury was in retrograde and so was my client’s confidence.'],
  'npc-behavior': ['Everyone in the group chat would have done the same.', 'It was muscle memory, not a choice. Blame the thumbs.', 'My client was being polite. Aggressively, repeatedly polite.'],
  'internet-crimes': ['Engagement is engagement. My client was simply being seen.', 'It was satire. The audience was not ready.', 'Posting through it is a form of courage.'],
};

const PROSECUTION_JABS: readonly string[] = [
  'The defendant had every chance to log off. They chose violence instead.',
  'This was not an accident. It was a lifestyle.',
  'Members of the jury, the cringe is documented, timestamped and screenshotted.',
];

const DEFENSE_JABS: readonly string[] = [
  'My client is not cooked. My client is marinating, which is a process.',
  'If cringe were a crime, everyone in this room would be serving life.',
  'Context matters, and the context here is pure, unfiltered chaos.',
];

const SENTENCES: Readonly<Record<'guilty' | 'not-cooked' | 'none', readonly string[]>> = {
  guilty: [
    'The jury has spoken: GUILTY. The court sentences the defendant to touch grass for 48 consecutive hours.',
    'GUILTY. The defendant shall mute the group chat and reflect on their choices until further notice.',
    'GUILTY as charged. The court orders one (1) sincere apology, delivered without emojis.',
  ],
  'not-cooked': [
    'The jury says NOT COOKED. The defendant may continue cooking, under supervision.',
    'NOT COOKED. Case dismissed. The court reminds the defendant that this was very close.',
    'NOT COOKED. Let bro cook. The court will be watching the kitchen.',
  ],
  none: ['MISTRIAL. Not enough jurors finished voting in time, so every coin goes back where it came from.'],
};

export class DemoCounsel implements AiCounselPort {
  readonly id = 'fixture' as const;
  readonly requests: CounselRequest[] = [];

  constructor(private readonly options: DemoCounselOptions = {}) {}

  async #wait(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) throw new CounselError('aborted', 'Aborted');
    const ms = this.options.latencyMs ?? 0;
    if (ms > 0) await new Promise((r) => setTimeout(r, ms));
    if (signal?.aborted) throw new CounselError('aborted', 'Aborted');
  }

  async suggestAngles(request: AngleRequest, signal?: AbortSignal): Promise<readonly AngleSuggestion[]> {
    await this.#wait(signal);
    return ANGLES[request.category].map((text, i) => ({ id: `angle-${i + 1}`, text: text.slice(0, 140) }));
  }

  async draft(request: CounselRequest, signal?: AbortSignal): Promise<CounselDraft> {
    this.requests.push(request);
    await this.#wait(signal);
    const [p, d] = request.briefs;
    const seed = `${request.trialId}:${request.attempt}`;
    const story = gist(p.publicText);
    const angle = d.angle ? `“${d.angle}”` : '“Context is everything.”';
    const [guilty, notCooked] = request.ballot;
    let n = 0;
    const id = () => `L${String(++n).padStart(2, '0')}`;
    const carried = request.carryOver?.filter((l) => l.segment === 'call-to-order' || l.segment === 'opening') ?? [];
    const lines: CourtLine[] = carried.length
      ? carried.map((l) => ({ ...l, id: id() }))
      : [
          { id: id(), speaker: 'judge', segment: 'call-to-order', beat: 'gavel', text: `ORDER! Court is in session. The case of “${request.title}”. Miss Ratio, you may begin.` },
          {
            id: id(),
            speaker: 'prosecutor',
            bench: 0,
            segment: 'opening',
            beat: 'desk-slam',
            text: `The facts, Your Honor: ${story}. ${pick(PROSECUTION_JABS, `${seed}:p1`)}`,
          },
          {
            id: id(),
            speaker: 'defense',
            bench: 1,
            segment: 'opening',
            beat: 'smug',
            text: `Counsel Chaos for the defense. Our position is simple: ${angle} ${pick(DEFENSE_JABS, `${seed}:d1`)}`,
          },
        ];
    if (request.scope === 'teaser') {
      lines.push({ id: id(), speaker: 'judge', segment: 'jury-out', beat: 'dramatic-pause', text: 'THE JURY IS OUT.' });
    } else {
      request.exhibits.slice(0, 4).forEach((x, i) => {
        const bench = (i % 2) as 0 | 1;
        lines.push({
          id: id(),
          speaker: bench === 0 ? 'prosecutor' : 'defense',
          bench,
          segment: 'exhibit',
          beat: 'present-evidence',
          exhibitId: x.id,
          text:
            bench === 0
              ? `I present Exhibit ${String.fromCharCode(65 + i)}, “${x.title}”: ${gist(x.body, 80)}. The jury may gasp now.`
              : `Exhibit ${String.fromCharCode(65 + i)}, “${x.title}”, shows a human being doing their best: ${gist(x.body, 70)}.`,
        });
      });
      lines.push(
        { id: id(), speaker: 'prosecutor', bench: 0, segment: 'rebuttal', beat: 'objection', text: 'OBJECTION! The defense is calling a pattern of behaviour “context”. That is not context, that is a rap sheet.' },
        { id: id(), speaker: 'defense', bench: 1, segment: 'rebuttal', beat: 'point', text: 'Counter! A rap sheet needs a crime. Being a little bit cringe in public is called being alive, Miss Ratio.' },
        { id: id(), speaker: 'judge', segment: 'rebuttal', beat: 'gasp', text: 'The court notes a gasp from the gallery. The gallery will remain seated.' },
        { id: id(), speaker: 'prosecutor', bench: 0, segment: 'closing', beat: 'point', text: `Members of the jury: you saw it, you felt it, you cringed. Vote ${guilty} and let the record show it.` },
        { id: id(), speaker: 'defense', bench: 1, segment: 'closing', beat: 'laugh', text: `Members of the jury: everyone has a day like this. Vote ${notCooked}. Let bro cook.` },
        { id: id(), speaker: 'judge', segment: 'jury-out', beat: 'gavel', text: 'The jury will now seal its verdict in secret. THE JURY IS OUT.' },
      );
    }
    const words = (b: 0 | 1) => lines.filter((l) => l.bench === b).reduce((s, l) => s + l.text.split(/\s+/).length, 0);
    const rid = (bench: number) => `demo-${request.trialId}-${request.attempt}-${bench}`;
    return {
      lines,
      usage: [
        { inputTokens: Math.min(request.budget.maxInputTokens, 300 + p.publicText.length / 4), outputTokens: Math.min(request.budget.maxOutputTokens, words(0) * 2), requestIds: [rid(0)] },
        { inputTokens: Math.min(request.budget.maxInputTokens, 300 + d.publicText.length / 4), outputTokens: Math.min(request.budget.maxOutputTokens, words(1) * 2), requestIds: [rid(1)] },
      ],
      provider: 'fixture',
      model: 'demo-scripted-counsel-v1',
      attempt: request.attempt,
    };
  }

  async assessBalance(draft: CounselDraft): Promise<BalanceReport> {
    return assessBalanceByLength(draft);
  }

  async sentence(request: SentenceRequest, signal?: AbortSignal): Promise<CourtLine> {
    await this.#wait(signal);
    const key = request.verdictLabel === 'NO VERDICT' ? 'none' : request.verdictLabel === 'GUILTY' ? 'guilty' : 'not-cooked';
    return { id: 'S01', speaker: 'judge', segment: 'sentence', beat: 'gavel', text: pick(SENTENCES[key], request.transcriptHash) };
  }
}
