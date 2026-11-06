import type { CancelReason, CharacterId, Category, TrialStage, Usdc } from '@cringe-court/core';
import { en, t, type MessageKey } from '@/i18n';
import { getIntlLocale } from '@/i18n/runtime';

/**
 * Render-time labels for domain enums and ids that live in packages/*.
 * The packages keep their English tables (tests and other consumers use
 * them); the web layer maps each id to a catalog key. Call at render time only.
 */

/** Exact decimal formatting of a micro-unit amount in the active locale, no unit. */
function formatDecimal(amount: Usdc, minFractionDigits = 2): string {
  const SCALE = 1_000_000n;
  const whole = amount / SCALE;
  let frac = (amount % SCALE).toString().padStart(6, '0').replace(/0+$/, '');
  if (frac.length < minFractionDigits) frac = frac.padEnd(minFractionDigits, '0');
  const nf = new Intl.NumberFormat(getIntlLocale(), { minimumFractionDigits: frac.length, maximumFractionDigits: frac.length });
  // Intl formats exact decimal strings, so micro-units are never rounded through a float.
  return nf.format(`${whole}${frac ? `.${frac}` : ''}` as unknown as number);
}

/** `formatUsdc` replacement: "1,000.00 USDC" (unit: true) or just the number. */
export function formatAmount(amount: Usdc, options: { unit?: boolean; minFractionDigits?: number } = {}): string {
  const text = formatDecimal(amount, options.minFractionDigits);
  return options.unit === false ? text : t('domain.usdc.short', { amount: text });
}

export const categoryLabel = (c: Category): string => t(`domain.category.${c}`);
export const cancelLabel = (r: CancelReason): string => t(`domain.cancel.${r}`);
export const stageLabel = (s: TrialStage): string => t(`domain.stage.${s}`);
export const characterName = (id: CharacterId): string => t(`domain.character.${id}`);

const BALLOT_KEYS: Readonly<Record<string, MessageKey>> = {
  GUILTY: 'domain.ballot.guilty',
  'NOT COOKED': 'domain.ballot.notCooked',
  'SIDE A': 'domain.ballot.sideA',
  'SIDE B': 'domain.ballot.sideB',
  FOR: 'domain.ballot.for',
  AGAINST: 'domain.ballot.against',
};

/** A ballot option label: the built-in Solo/Versus pairs are translated; Grand Jury titles are case content and pass through. */
export function ballotLabel(label: string): string {
  const key = BALLOT_KEYS[label];
  return key ? t(key) : label;
}

/** A verdict stamp: the winning ballot label or "NO VERDICT". */
export const verdictLabel = (label: string): string => (label === 'NO VERDICT' ? t('domain.verdict.none') : ballotLabel(label));

export const ballotLabels = (ballot: readonly [string, string]): readonly [string, string] => [ballotLabel(ballot[0]), ballotLabel(ballot[1])];

/** "SIDE A", or "SIDE A “Sir Loin”" when the side approved a nickname. */
export function sideLabel(side: 'a' | 'b', filing?: { nickname?: string | null } | null, options: { quotes?: boolean } = {}): string {
  const label = t('domain.side.label', { side: side.toUpperCase() });
  const nick = filing?.nickname?.trim();
  if (!nick) return label;
  return t(options.quotes === false ? 'domain.side.nickPlain' : 'domain.side.nick', { label, nick });
}

export const soloCategoryExample = (c: Category) => ({
  name: categoryLabel(c),
  blurb: t(`domain.soloCategory.${c}.blurb`),
  example: t(`domain.soloCategory.${c}.example`),
  exampleTitle: t(`domain.soloCategory.${c}.exampleTitle`),
});

export const soloRedactionLabel = (kind: 'email' | 'url' | 'wallet' | 'ens' | 'phone' | 'handle' | 'name'): string => t(`domain.soloRedaction.${kind}`);

export const segmentTitle = (segment: 'call-to-order' | 'opening' | 'exhibit' | 'rebuttal' | 'closing' | 'jury-out' | 'sentence'): string => t(`domain.segment.${segment}`);

export const outcomeLabel = (o: 'verdict' | 'verdict-with-no-show' | 'no-verdict' | 'consent-missed' | 'withdrawn' | 'funding-missed' | 'jury-unfilled'): string =>
  t(`domain.outcome.${o}`);

export const routeOutCopy = (topic: 'safety' | 'money' | 'custody' | 'self-harm') => ({ title: t(`domain.routeOut.${topic}.title`), body: t(`domain.routeOut.${topic}.body`) });

export const versusStepLabel = (step: 'Invite' | 'Briefs' | 'Counsel' | 'Funding' | 'Jury' | 'Verdict'): string =>
  t(`domain.versusStep.${step.toLowerCase() as Lowercase<typeof step>}`);

export const pricingName = (phase: 'hackathon' | 'launch'): string => t(`domain.pricing.${phase}.name`);

export type ScreeningCopyKey =
  | 'title'
  | 'intro'
  | 'honesty'
  | 'success'
  | 'not_verified'
  | 'ineligible_level'
  | 'is_party'
  | 'already_seated'
  | 'cancelled'
  | 'expired'
  | 'already_verified'
  | 'invalid_proof'
  | 'wrong_action'
  | 'network'
  | 'malformed';
export const screeningCopy = (key: ScreeningCopyKey): string => t(`domain.screening.${key}`);

/** Plain-language copy for a contract revert, by error code; undefined when the code has no copy. */
export function courtErrorCopy(code: string): string | undefined {
  const key = `domain.error.${code}`;
  return key.slice('domain.'.length) in en.domain ? t(key as MessageKey) : undefined;
}

export const npcPersona = (id: string) => ({
  name: t(`domain.npc.${id}.name` as MessageKey),
  bio: t(`domain.npc.${id}.bio` as MessageKey),
  says: [t(`domain.npc.${id}.says0` as MessageKey), t(`domain.npc.${id}.says1` as MessageKey)] as const,
});

type HitKind = 'email' | 'url' | 'phone' | 'wallet' | 'ens' | 'handle' | 'number';
/** "2 phone numbers and 1 link" for the review screen. */
export function describeHits(hits: readonly { kind: HitKind }[]): string {
  if (hits.length === 0) return t('domain.hits.none');
  const counts = new Map<HitKind, number>();
  for (const h of hits) counts.set(h.kind, (counts.get(h.kind) ?? 0) + 1);
  const parts = [...counts].map(([kind, count]) => t(`domain.hits.${kind}`, { count }));
  const list = parts.length === 1 ? parts[0]! : t('domain.hits.and', { head: parts.slice(0, -1).join(', '), last: parts[parts.length - 1]! });
  return t('domain.hits.removed', { list });
}

/** "CASE #0042". */
export const formatCaseNo = (n: number | bigint): string => t('domain.caseNumber', { n: String(n).padStart(4, '0') });

/** A package-formatted case label ("CASE #0042") re-rendered in the active locale; anything else passes through. */
export function caseLabel(label: string): string {
  const m = /^CASE #(\d+)$/.exec(label);
  return m ? t('domain.caseNumber', { n: m[1]! }) : label;
}
