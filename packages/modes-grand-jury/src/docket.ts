/**
 * The public docket: which reviewed case file each on-chain Grand Jury case is,
 * its frozen transcript, and a public court record built from ledger events.
 * The ledger stays the source of truth for money and phase; the docket only
 * adds what the contract doesn't store (copy, transcript, a readable log).
 */
import {
  formatCaseNumber,
  formatUsdc,
  type AiCounselPort,
  type CaseNumber,
  type ChainEvent,
  type ChainPort,
  type CounselRequest,
  type CourtLine,
  type Hex,
  type TxReceipt,
  type Unsubscribe,
  type Usdc,
} from '@cringe-court/core';
import { ballotOf, type CaseFile, type CaseSponsor } from './catalog';
import { assessScriptBalance, transcriptHash } from './counsel';
import { grandJuryMode } from './definition';
import { canPublish, CURRENT_PRICING, type PricingProfile } from './pricing';

export interface PublishedCase {
  caseNumber: CaseNumber;
  file: CaseFile;
  ballot: readonly [string, string];
  /** The frozen full transcript; the docket shows the teaser until the jury is seated. */
  transcript: readonly CourtLine[];
  transcriptHash: Hex;
  provider: 'og-compute' | 'fixture';
  model: string;
  publishedAt: number;
  basis: 'sponsored' | 'marketing-cap';
  sponsor: (CaseSponsor & { account: Hex; amount: Usdc }) | null;
  /** Demo builds shorten deadlines and must say so (D14). */
  demoTiming: boolean;
}

export type LogKind =
  | 'published'
  | 'summoned'
  | 'sponsored'
  | 'funded'
  | 'seated'
  | 'in-session'
  | 'sealed'
  | 'scrolls-open'
  | 'opened'
  | 'settle-ready'
  | 'verdict'
  | 'cancelled';

export interface LogEntry {
  id: number;
  caseNumber: CaseNumber;
  at: number;
  kind: LogKind;
  text: string;
  account?: Hex;
  amount?: Usdc;
}

const CANCEL_COPY: Record<string, string> = {
  'funding-missed': 'The crowd fell short before the funding deadline. Every summoner can claim a full refund.',
  'jury-unfilled': 'The jury did not fill in time. Every summoner and juror can claim a full refund.',
  protective: 'The court cancelled this case for safety. Everyone is refunded in full.',
};

export class Docket {
  readonly #cases = new Map<CaseNumber, PublishedCase>();
  readonly #log = new Map<CaseNumber, LogEntry[]>();
  readonly #listeners = new Set<() => void>();
  #nextLog = 0;
  #marketingUsed = 0;

  constructor(
    readonly clock: () => number,
    readonly pricing: PricingProfile = CURRENT_PRICING,
  ) {}

  get marketingUsed(): number {
    return this.#marketingUsed;
  }

  get(n: CaseNumber): PublishedCase | undefined {
    return this.#cases.get(n);
  }

  list(): readonly PublishedCase[] {
    return [...this.#cases.values()];
  }

  /** Find a case by its reviewed slug (share links use it). */
  bySlug(slug: string): PublishedCase | undefined {
    return this.list().find((c) => c.file.slug === slug);
  }

  log(n: CaseNumber): readonly LogEntry[] {
    return this.#log.get(n) ?? [];
  }

  onChange(fn: () => void): Unsubscribe {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  /** Follow the ledger and keep a public court record. Call once per ledger. */
  attach(chain: ChainPort): Unsubscribe {
    return chain.subscribe('*', (e) => this.#record(e));
  }

  register(c: PublishedCase): void {
    this.#cases.set(c.caseNumber, c);
    if (c.basis === 'marketing-cap') this.#marketingUsed++;
    this.#append(c.caseNumber, 'published', `${formatCaseNumber(c.caseNumber)} is on the docket. Reviewed and signed off by the ${c.file.review.editor}.`);
    if (c.sponsor) this.#append(c.caseNumber, 'sponsored', `${c.sponsor.line}.`);
    this.#emit();
  }

  #append(caseNumber: CaseNumber, kind: LogKind, text: string, extra: Partial<Pick<LogEntry, 'account' | 'amount'>> = {}): void {
    const list = this.#log.get(caseNumber) ?? [];
    list.push({ id: ++this.#nextLog, caseNumber, at: this.clock(), kind, text, ...extra });
    this.#log.set(caseNumber, list);
  }

  #record(e: ChainEvent): void {
    const c = this.#cases.get(e.caseNumber);
    if (!c) return;
    const n = e.caseNumber;
    switch (e.type) {
      case 'funded':
        if (e.kind === 'contributor') this.#append(n, 'summoned', `A summoner chipped in ${formatUsdc(e.amount)}.`, { account: e.account, amount: e.amount });
        break;
      case 'phase':
        if (e.phase === 'recruiting') this.#append(n, 'funded', 'Fully funded. Jury selection is open to verified humans.');
        if (e.phase === 'commit') this.#append(n, 'in-session', 'All seven seated. Court is in session: the full arguments are up and ballots are sealing.');
        if (e.phase === 'reveal') this.#append(n, 'scrolls-open', 'Ballots are sealed. Jurors are opening their scrolls.');
        if (e.phase === 'finalizing') this.#append(n, 'settle-ready', 'Every deadline has passed. Anyone can settle the case now.');
        break;
      case 'seat-accepted':
        this.#append(n, 'seated', `Juror ${e.seat} was sworn in and posted a bond.`);
        break;
      case 'committed':
        this.#append(n, 'sealed', 'A juror sealed a secret ballot.');
        break;
      case 'revealed':
        this.#append(n, 'opened', 'A juror opened their scroll.');
        break;
      case 'finalized':
        this.#append(
          n,
          'verdict',
          e.verdictKind === 'no-verdict'
            ? 'NO VERDICT. Fewer than four jurors agreed, so summoners are refunded in full.'
            : `Verdict: ${c.ballot[e.verdictKind === 'ballot-0' ? 0 : 1]}.`,
        );
        break;
      case 'cancelled':
        this.#append(n, 'cancelled', CANCEL_COPY[e.reason] ?? 'The case was cancelled. Everyone is refunded in full.');
        break;
      default:
        return;
    }
    this.#emit();
  }

  #emit(): void {
    for (const fn of [...this.#listeners]) fn();
  }
}

export class PublishError extends Error {
  constructor(
    readonly code: 'sponsor-below-floor' | 'sponsor-required' | 'marketing-cap-reached' | 'unbalanced' | 'ledger',
    message: string,
  ) {
    super(message);
    this.name = 'PublishError';
  }
}

export interface PublishOptions {
  docket: Docket;
  /** The ledger, signing as the court editor. */
  chain: ChainPort;
  counsel: AiCounselPort;
  file: CaseFile;
  /** A sponsor commitment made before publication (D10). Its deposit is placed by `sponsorChain`. */
  sponsor?: { account: Hex; amount: Usdc; chain: ChainPort };
  /** Shortened demo deadlines (labelled in the UI, D14). */
  demoDeadlines?: { preTrial: number; recruitment: number; commit: number; reveal: number };
}

/**
 * The editor's publishing tool: enforce the D10 publication rule, freeze the
 * terms (with the reviewed ballot titles), draft and balance-check the show,
 * fingerprint it, open the case on the ledger and place the sponsor deposit.
 */
export async function publishCase(o: PublishOptions): Promise<{ published: PublishedCase; receipt: TxReceipt }> {
  const pricing = o.docket.pricing;
  const decision = canPublish(pricing, { sponsorDeposit: o.sponsor?.amount ?? null, marketingUsed: o.docket.marketingUsed });
  if (!decision.ok) throw new PublishError(decision.reason, decision.message);
  const ballot = ballotOf(o.file);
  const terms = grandJuryMode.terms({
    ballot,
    sponsorDeposit: null,
    ...(o.demoDeadlines ? { deadlines: o.demoDeadlines } : {}),
  });
  const request: CounselRequest = {
    trialId: o.file.slug,
    mode: 'grand-jury',
    category: o.file.category,
    title: o.file.title,
    ballot,
    benches: grandJuryMode.benches,
    briefs: [
      { choice: 0, role: 'prosecution', counsel: 'prosecutor', client: null, publicText: `${o.file.context}\n${o.file.positions[0].summary}` },
      { choice: 1, role: 'defense', counsel: 'defense', client: null, publicText: `${o.file.context}\n${o.file.positions[1].summary}` },
    ],
    exhibits: o.file.sources.map((s) => ({ id: s.id, submittedBy: 'court', kind: 'quote', title: s.label, body: s.note })),
    scope: 'full',
    payer: ['platform', 'platform'],
    budget: { maxInputTokens: 2400, maxOutputTokens: 700 },
    attempt: 1,
  };
  const draft = await o.counsel.draft(request);
  const balance = await o.counsel.assessBalance(draft, request);
  if (!balance.ok) throw new PublishError('unbalanced', `The AI could not prepare a fair case: ${balance.reasons.join('; ')}`);
  const hash = transcriptHash(draft.lines);
  let created;
  try {
    created = await o.chain.createCase({ terms, transcriptHash: hash, payers: [], title: o.file.title });
    if (o.sponsor) await o.sponsor.chain.sponsor(created.caseNumber, o.sponsor.amount);
  } catch (err) {
    throw new PublishError('ledger', err instanceof Error ? err.message : String(err));
  }
  const published: PublishedCase = {
    caseNumber: created.caseNumber,
    file: o.file,
    ballot,
    transcript: draft.lines,
    transcriptHash: hash,
    provider: draft.provider,
    model: draft.model,
    publishedAt: o.docket.clock(),
    basis: decision.basis,
    sponsor: o.sponsor && o.file.sponsor ? { ...o.file.sponsor, account: o.sponsor.account, amount: o.sponsor.amount } : null,
    demoTiming: Boolean(o.demoDeadlines),
  };
  o.docket.register(published);
  return { published, receipt: created.receipt };
}

/** Sanity check used by tests and the publishing tool preview. */
export function scriptIsBalanced(file: CaseFile): boolean {
  return assessScriptBalance(file.script).ok;
}
