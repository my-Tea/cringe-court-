/**
 * ModeRegistry: how a game mode plugs in.
 *
 * A mode is a `ModeDefinition` (rules, benches, staging, pricing options),
 * published by `packages/modes-<mode>` and registered by the app in
 * `apps/web/src/modes/<mode>/`. The engine runs any registered mode; it never
 * branches on a mode id. Core ships a base definition per mode (BASE_MODES) that
 * mode packages extend with `extendMode()`.
 */
import type { Hex } from './case';
import { CHARACTER_NAMES, type Benches, type SideId } from './cast';
import { MODES, type ModeConfig, type ModeId } from './modes';
import type { CounselBrief } from './ports/counsel';
import type { CastMember, StageMark } from './ports/stage';
import { DEFAULT_RULES, type Filing, type TrialRules } from './trial';
import { termsFor, type CaseTerms, type TermsOptions } from './terms';

export interface ModeDefinition {
  id: ModeId;
  config: ModeConfig;
  rules: TrialRules;
  benches: Benches;
  /** Who stands where in the courtroom for this mode. */
  staging: (terms: CaseTerms) => readonly CastMember[];
  /** Freeze this mode's terms for a new case. */
  terms: (options?: TermsOptions) => CaseTerms;
  /** Copy for a bench's nameplate ("Counsel Chaos — for you"). */
  benchLabel: (choice: 0 | 1, viewer: SideId | null) => string;
}

export class ModeRegistry {
  readonly #modes = new Map<ModeId, ModeDefinition>();

  register(definition: ModeDefinition, options: { replace?: boolean } = {}): this {
    if (this.#modes.has(definition.id) && !options.replace) throw new Error(`Mode "${definition.id}" is already registered`);
    validateDefinition(definition);
    this.#modes.set(definition.id, definition);
    return this;
  }

  has(id: ModeId): boolean {
    return this.#modes.has(id);
  }

  get(id: ModeId): ModeDefinition {
    const mode = this.#modes.get(id);
    if (!mode) throw new Error(`Mode "${id}" is not registered`);
    return mode;
  }

  list(): readonly ModeDefinition[] {
    return [...this.#modes.values()];
  }
}

function validateDefinition(d: ModeDefinition): void {
  if (d.config.id !== d.id) throw new Error(`Mode ${d.id}: config is for ${d.config.id}`);
  if (d.benches[0].choice !== 0 || d.benches[1].choice !== 1) throw new Error(`Mode ${d.id}: benches must be [choice 0, choice 1]`);
  for (const b of d.benches) {
    if (b.client !== null && !d.rules.sides.includes(b.client)) throw new Error(`Mode ${d.id}: bench client ${b.client} is not a side`);
  }
  for (const a of d.rules.approvers) {
    if (a !== 'court' && !d.rules.sides.includes(a)) throw new Error(`Mode ${d.id}: approver ${a} is not a side`);
  }
  const marks = d.staging(d.terms()).map((c) => c.actor);
  if (new Set(marks).size !== marks.length) throw new Error(`Mode ${d.id}: staging has duplicate actors`);
}

/** Override parts of a definition (mode packages build on BASE_MODES). */
export function extendMode(base: ModeDefinition, patch: Partial<Omit<ModeDefinition, 'id' | 'rules'>> & { rules?: Partial<TrialRules> }): ModeDefinition {
  return { ...base, ...patch, rules: { ...base.rules, ...patch.rules } };
}

const JURY_MARKS: readonly StageMark[] = ['jury-1', 'jury-2', 'jury-3', 'jury-4', 'jury-5', 'jury-6', 'jury-7'];

function court(terms: CaseTerms, counsel: readonly [CastMember, CastMember], extra: readonly CastMember[] = []): readonly CastMember[] {
  return [
    { actor: 'judge', character: 'judge', mark: 'bench' },
    ...counsel,
    { actor: 'bailiff', character: 'bailiff', mark: 'bailiff' },
    { actor: 'clerk', character: 'clerk', mark: 'clerk' },
    ...JURY_MARKS.slice(0, terms.jurySize).map((mark, i): CastMember => ({ actor: `juror-${i + 1}`, character: 'juror', mark })),
    ...extra,
  ];
}

const solo: ModeDefinition = {
  id: 'solo',
  config: MODES.solo,
  rules: { ...DEFAULT_RULES, sides: ['a'], approvers: ['a'] },
  // D1: Counsel Chaos is the user's advocate; Miss Ratio is the NPC opponent.
  benches: [
    { choice: 0, role: 'prosecution', counsel: 'prosecutor', client: null },
    { choice: 1, role: 'defense', counsel: 'defense', client: 'a' },
  ],
  staging: (terms) =>
    court(
      terms,
      [
        { actor: 'prosecutor', character: 'prosecutor', mark: 'prosecution' },
        { actor: 'defense', character: 'defense', mark: 'defense' },
      ],
      [{ actor: 'creator', character: 'creator', mark: 'witness' }],
    ),
  terms: (options) => termsFor(MODES.solo, options),
  benchLabel: (choice, viewer) =>
    choice === 0 ? `${CHARACTER_NAMES.prosecutor} — prosecution` : `${CHARACTER_NAMES.defense} — ${viewer === 'a' ? 'your lawyer' : 'defense'}`,
};

const versus: ModeDefinition = {
  id: 'versus',
  config: MODES.versus,
  rules: { ...DEFAULT_RULES, sides: ['a', 'b'], approvers: ['a', 'b'], requiresConsent: true },
  benches: [
    { choice: 0, role: 'prosecution', counsel: 'side-a', client: 'a' },
    { choice: 1, role: 'defense', counsel: 'side-b', client: 'b' },
  ],
  staging: (terms) =>
    court(terms, [
      { actor: 'side-a', character: 'side-a', mark: 'prosecution' },
      { actor: 'side-b', character: 'side-b', mark: 'defense' },
    ]),
  terms: (options) => termsFor(MODES.versus, options),
  benchLabel: (choice, viewer) => {
    const side: SideId = choice === 0 ? 'a' : 'b';
    return `Side ${side.toUpperCase()}${viewer === side ? ' — you' : ''}`;
  },
};

const grandJury: ModeDefinition = {
  id: 'grand-jury',
  config: MODES['grand-jury'],
  // D8/D9: no parties; the court editor approves the reviewed context card and draft.
  rules: { ...DEFAULT_RULES, sides: [], approvers: ['court'], maxExhibits: 8, storyMaxChars: 2000 },
  benches: [
    { choice: 0, role: 'prosecution', counsel: 'prosecutor', client: null },
    { choice: 1, role: 'defense', counsel: 'defense', client: null },
  ],
  staging: (terms) =>
    court(
      terms,
      [
        { actor: 'prosecutor', character: 'prosecutor', mark: 'prosecution' },
        { actor: 'defense', character: 'defense', mark: 'defense' },
      ],
      [{ actor: 'narrator', character: 'ai-narrator', mark: 'witness' }],
    ),
  terms: (options) => termsFor(MODES['grand-jury'], options),
  benchLabel: (choice) => (choice === 0 ? 'FOR' : 'AGAINST'),
};

export const BASE_MODES: Readonly<Record<ModeId, ModeDefinition>> = { solo, versus, 'grand-jury': grandJury };

/** A registry with the three base modes. Mode packages may `register(…, { replace: true })`. */
export function createModeRegistry(withBase = true): ModeRegistry {
  const registry = new ModeRegistry();
  if (withBase) for (const def of Object.values(BASE_MODES)) registry.register(def);
  return registry;
}

/**
 * The information wall (D1), in one place. A bench gets its own client's story,
 * private notes and angle. A bench with no client (Solo's NPC opponent, Grand
 * Jury positions) gets only public text: the other bench's public story (Solo)
 * or the reviewed context card (Grand Jury). No bench ever gets another side's
 * private notes.
 */
export function briefsFor(benches: Benches, filing: Filing): readonly [CounselBrief, CounselBrief] {
  const brief = (choice: 0 | 1): CounselBrief => {
    const bench = benches[choice];
    const other = benches[choice === 0 ? 1 : 0];
    const own = bench.client ? filing.sides[bench.client] : undefined;
    const opposing = other.client ? filing.sides[other.client] : undefined;
    const publicText = own?.story ?? opposing?.story ?? filing.context;
    const out: CounselBrief = { choice, role: bench.role, counsel: bench.counsel, client: bench.client, publicText: publicText || filing.context };
    if (own?.privateNotes) out.privateNotes = own.privateNotes;
    if (own?.angle) out.angle = own.angle;
    if (own?.nickname) out.nickname = own.nickname;
    return out;
  };
  return [brief(0), brief(1)];
}

/** Lower-cased party accounts, for jury exclusion. */
export function partiesOf(filing: Filing): readonly Hex[] {
  return Object.values(filing.sides)
    .map((s) => s?.account)
    .filter((a): a is Hex => Boolean(a))
    .map((a) => a.toLowerCase() as Hex);
}
