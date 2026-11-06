import type { TrialState } from '@cringe-court/core';
import { useChangeCue, usePhaseCue } from '@/platform/audio';
import { soloPhase } from '../lib/sound';

/**
 * Case-state sound for the solo case page, once per transition: the ambience
 * bed follows the phase, and a dismissed case refunds with a coin sting. Seats,
 * sealed ballots and opened scrolls are voiced by JuryStage, the verdict by
 * VerdictPanel. Mount with `key={trialId}` so opening a case stays silent.
 */
export function CaseSounds({ t }: { t: TrialState }) {
  usePhaseCue(soloPhase(t));
  useChangeCue(t.stage, (stage, was) => (stage === 'closed' && was !== 'closed' ? { type: 'settlement', kind: 'refund' } : null));
  return null;
}
