import type { CaseDetail } from '@cringe-court/modes-grand-jury';
import { useChangeCue, useDeadlineCues, usePhaseCue } from '@/platform/audio';
import { verdictOutcome } from '../lib';
import { useCourtNowMs } from '../state/hooks';

/**
 * Sound for one loaded Grand Jury case, once per transition (never per render
 * or tick): the ambience bed and phase stingers follow the case phase; seats,
 * sealed ballots and opened scrolls (yours and the crowd's) tick up; the verdict
 * lands once; the last 30 seconds of a window tick down. Mount with
 * `key={caseNumber}` so opening a case stays silent.
 */
export function CaseSounds({ detail }: { detail: CaseDetail }) {
  usePhaseCue(detail.phase);
  useChangeCue(detail.seats.filled, (n, was) => (n > was ? { type: 'juror.seated', index: n - 1 } : null));
  useChangeCue(detail.seats.sealed, (n, was) => (n > was ? { type: 'ballot.committed' } : null));
  useChangeCue(detail.seats.opened, (n, was) => (n > was ? { type: 'ballot.revealed' } : null));
  useChangeCue(detail.verdict?.kind ?? null, (k, was) => (k !== null && was === null ? { type: 'verdict.read', outcome: verdictOutcome(k) } : null));
  useDeadlineCues(detail.phaseEndsAt === null ? null : detail.phaseEndsAt * 1000, useCourtNowMs());
  return null;
}
