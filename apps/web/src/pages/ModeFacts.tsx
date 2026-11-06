import { MODES, caseCharge, jurySize, verdictThreshold, type ModeId } from '@cringe-court/core';
import { Amount } from '@/ds';
import styles from './pages.module.css';

const minutes = (s: number) => `${Math.round(s / 60)} min`;
const hours = (s: number) => `${Math.round(s / 3600)} h`;

/** The numbers that matter before paying (V4 §6.2), straight from the core constants. */
export function ModeFacts({ id, detailed = false }: { id: ModeId; detailed?: boolean }) {
  const mode = MODES[id];
  const { economics, deadlines, ballot } = mode;
  return (
    <dl className={styles.facts}>
      <div>
        <dt>Jury</dt>
        <dd>
          {jurySize(mode)} verified humans · {verdictThreshold(mode)} must match
        </dd>
      </div>
      <div>
        <dt>Ballot</dt>
        <dd>
          {ballot[0]} / {ballot[1]}
        </dd>
      </div>
      <div>
        <dt>{mode.funding.kind === 'split' ? 'Case charge (both sides)' : mode.funding.kind === 'crowdfund' ? 'Crowdfund target' : 'Case charge'}</dt>
        <dd>
          <Amount value={caseCharge(mode)} size="sm" />
        </dd>
      </div>
      {detailed && (
        <>
          <div>
            <dt>Juror bond</dt>
            <dd>
              <Amount value={economics.bondPerJuror} size="sm" />
            </dd>
          </div>
          <div>
            <dt>Juror reward on a verdict</dt>
            <dd>
              <Amount value={economics.successBonusPerJuror} size="sm" />
            </dd>
          </div>
          <div>
            <dt>Deadlines</dt>
            <dd>
              {deadlines.preTrial !== null && <>{hours(deadlines.preTrial)} {id === 'versus' ? 'consent' : 'funding'} · </>}
              {minutes(deadlines.recruitment)} jury · {minutes(deadlines.commit)} seal · {minutes(deadlines.reveal)} reveal
            </dd>
          </div>
        </>
      )}
    </dl>
  );
}
