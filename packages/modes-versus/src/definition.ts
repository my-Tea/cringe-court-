/**
 * The Versus mode definition: two real people, one AI advocate each (Agent A
 * argues Side A's case from the prosecution bench, Agent B answers from the
 * defense bench), three random verified jurors, SIDE A / SIDE B ballot (D5).
 *
 * Built on core's BASE_MODES.versus so the engine, ballot contract and
 * settlement maths stay shared with the other modes.
 */
import {
  BASE_MODES,
  MODES,
  extendMode,
  termsFor,
  type CaseTerms,
  type Deadlines,
  type ModeDefinition,
  type SideFiling,
  type SideId,
  type TermsOptions,
} from '@cringe-court/core';

const MIN = 60;

/**
 * Demo-speed deadlines (D14: "demo builds may use shorter windows, labelled as
 * such"). The production windows are MODES.versus.deadlines: 24 h consent and
 * funding, 30 / 20 / 10 min recruitment, commit and reveal.
 *
 * The commit window opens with the hearing, so it must outlast it (B2): the
 * first-person hearing runs about 3 min (174 s in the playtest), then a juror
 * needs time to decide and seal. Six minutes covers both with room to spare,
 * and costs no waiting: the demo clerk closes a window as soon as every
 * seated juror has acted in it (`VersusDesk.tick`).
 */
export const VERSUS_DEMO_DEADLINES: Deadlines = { preTrial: 15 * MIN, recruitment: 10 * MIN, commit: 6 * MIN, reveal: 2 * MIN };

/** Each side brings at most this many exhibits (the trial caps the case at `maxExhibits`). */
export const EXHIBITS_PER_SIDE = 3;

/** D6 abuse limit: open, unconsented invites per filer. */
export const OPEN_INVITE_LIMIT = 3;

export const versusMode: ModeDefinition = extendMode(BASE_MODES.versus, {
  rules: {
    maxExhibits: EXHIBITS_PER_SIDE * 2,
    storyMaxChars: 1200,
    redraftsPerSide: 1,
    autoRedrafts: 1,
  },
  benchLabel: (choice, viewer) => {
    const side: SideId = choice === 0 ? 'a' : 'b';
    return `Agent ${side.toUpperCase()} — ${viewer === side ? 'your advocate' : `for Side ${side.toUpperCase()}`}`;
  },
});

/** Terms for a new Versus case. `demo` swaps in the labelled demo deadlines. */
export function versusTerms(options: TermsOptions & { demo?: boolean } = {}): CaseTerms {
  const { demo, ...rest } = options;
  return termsFor(MODES.versus, demo ? { ...rest, deadlines: { ...VERSUS_DEMO_DEADLINES, ...rest.deadlines } } : rest);
}

export const SIDES: readonly SideId[] = ['a', 'b'];

export function otherSide(side: SideId): SideId {
  return side === 'a' ? 'b' : 'a';
}

/** Bench (= ballot choice) a side's agent argues from. */
export function benchOf(side: SideId): 0 | 1 {
  return side === 'a' ? 0 : 1;
}

export function sideOfChoice(choice: 0 | 1): SideId {
  return choice === 0 ? 'a' : 'b';
}

/** "SIDE A", or "SIDE A “Sir Loin”" when the side approved a nickname (D5). */
export function sideLabel(side: SideId, filing?: Pick<SideFiling, 'nickname'> | null, options: { quotes?: boolean } = {}): string {
  const base = `SIDE ${side.toUpperCase()}`;
  const nick = filing?.nickname?.trim();
  if (!nick) return base;
  return options.quotes === false ? `${base} ${nick}` : `${base} “${nick}”`;
}
