import { seatsOf, type VersusCase } from '@cringe-court/modes-versus';
import { useChangeCue, usePhaseCue } from '@/platform/audio';
import { useVersus } from '../runtime/context';

/**
 * Sound for one loaded case, once per transition (never per render or tick):
 * the ambience bed follows the case phase; seats, sealed ballots and opened
 * scrolls tick up; the verdict and a dismissal-refund land once. Mount it with
 * `key={trialId}` so opening a case (or switching cases) stays silent.
 */
export function CaseSounds({ c }: { c: VersusCase }) {
  const { audio } = useVersus();
  const phase = c.chain?.phase ?? (c.state.stage === 'closed' ? 'cancelled' : 'draft');
  usePhaseCue(phase, audio);
  const seats = seatsOf(c);
  const verdictKind = c.state.stage === 'verdict' || c.state.stage === 'share' || c.state.stage === 'appeal' ? c.state.verdict.kind : null;
  useChangeCue(seats.length, (n, was) => (n > was ? { type: 'juror.seated', index: n - 1 } : null), audio);
  useChangeCue(seats.filter((x) => x.committed).length, (n, was) => (n > was ? { type: 'ballot.committed' } : null), audio);
  useChangeCue(seats.filter((x) => x.revealed).length, (n, was) => (n > was ? { type: 'ballot.revealed' } : null), audio);
  useChangeCue(
    verdictKind,
    (k, was) => (k !== null && was === null ? { type: 'verdict.read', outcome: k === 'ballot-0' ? 'side-a' : k === 'ballot-1' ? 'side-b' : 'no-verdict' } : null),
    audio,
  );
  useChangeCue(c.state.stage, (st, was) => (st === 'closed' && was !== 'closed' ? { type: 'settlement', kind: 'refund' } : null), audio);
  return null;
}
