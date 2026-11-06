/**
 * Mode 1 — Solo vs NPC (docs/GAME-MODES.md §2, DECISIONS D1–D3).
 *
 * The user files a confession. Counsel Chaos is *their* advocate (bench 1,
 * client 'a'); Miss Ratio is the NPC opponent (bench 0, no client) and only ever
 * sees the approved public text. Judge Gavel.exe hosts. A jury of 3 decides
 * GUILTY / NOT COOKED. Everything else (economics, deadlines) is core's
 * BASE_MODES.solo, which pins the DECISIONS constants.
 */
import { BASE_MODES, extendMode, type CaseTerms, type Deadlines, type ModeDefinition, type TermsOptions } from '@cringe-court/core';

export const soloMode: ModeDefinition = extendMode(BASE_MODES.solo, {
  // Same rules as the base; restated so the mode package owns its copy (D2: 1 redraft,
  // 140-char angle; D1: 1 automatic redraft before "AI could not prepare a fair case").
  rules: { redraftsPerSide: 1, autoRedrafts: 1, angleMaxChars: 140, maxExhibits: 4, storyMaxChars: 1200 },
});

/** Ballot choice of each bench, by name. */
export const PROSECUTION = 0 as const;
export const DEFENSE = 1 as const;

/** Private notes cap for the user's own advocate (A16 intake budget: ~1,200 input tokens). */
export const PRIVATE_NOTES_MAX = 600;
export const TITLE_MAX = 80;

/**
 * Demo deadlines (D14: "Demo-speed deadlines are labelled as demo settings").
 * The real Solo windows are 30 / 20 / 10 minutes. The commit window is long
 * enough to watch the whole trial first; the demo clock skips ahead once every
 * NPC juror has acted.
 */
export const DEMO_DEADLINES: Readonly<Pick<Deadlines, 'recruitment' | 'commit' | 'reveal'>> = {
  recruitment: 300,
  commit: 900,
  reveal: 300,
};

export interface SoloTermsOptions {
  /** Shorten the jury windows and label the case as a demo (D14). */
  demo?: boolean;
  /** D12: the user's own 0G Compute Pass. Only honoured while PASS_ENABLED. */
  pass?: boolean;
}

/**
 * D12: the Pass is "off by default in every mode until V4 §17 gate 2 passes"
 * (supported, secure delegated credit use). Flip only when that gate is confirmed.
 */
export const PASS_ENABLED = false;

/** Freeze Solo terms for a new case (DECISIONS rule 2). */
export function soloTerms(options: SoloTermsOptions = {}): CaseTerms {
  const terms: TermsOptions = {};
  if (options.demo) terms.deadlines = { ...DEMO_DEADLINES };
  if (options.pass && PASS_ENABLED) terms.passWaivers = [true];
  return soloMode.terms(terms);
}

/** True when the terms carry the demo deadlines (the UI must say so, D14). */
export function isDemoTerms(terms: CaseTerms): boolean {
  return terms.deadlines.commit === DEMO_DEADLINES.commit && terms.deadlines.reveal === DEMO_DEADLINES.reveal;
}
