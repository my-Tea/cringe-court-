/**
 * The Grand Jury ModeDefinition (registered by apps/web/src/modes/grand-jury).
 * Built on core's BASE_MODES entry: no parties, the court editor approves the
 * reviewed context card, two public positions argued by Miss Ratio (FOR, bench
 * 0) and Counsel Chaos (AGAINST, bench 1), a jury of 7 with 4 to win (D7, D8).
 * Adds the gallery to the staging and the D10 pricing profile to the terms.
 */
import { BASE_MODES, extendMode, termsFor, type CastMember, type ModeDefinition } from '@cringe-court/core';
import { CURRENT_PRICING } from './pricing';

const base = BASE_MODES['grand-jury'];

/** Spectators in the gallery (D11): they watch and call it, but never vote on the verdict. */
export const GALLERY_CAST: readonly CastMember[] = [
  { actor: 'gallery-1', character: 'player', mark: 'gallery-1' },
  { actor: 'gallery-2', character: 'creator', mark: 'gallery-2' },
];

export const grandJuryMode: ModeDefinition = extendMode(base, {
  config: CURRENT_PRICING.config,
  terms: (options) => termsFor(CURRENT_PRICING.config, options),
  staging: (terms) => [...base.staging(terms), ...GALLERY_CAST],
  // Bench labels are the reviewed ballot titles once a case has them; FOR/AGAINST otherwise.
  benchLabel: (choice) => (choice === 0 ? 'FOR' : 'AGAINST'),
});
