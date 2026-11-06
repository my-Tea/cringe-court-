import { MODES, caseCharge, jurySize, verdictThreshold, type ModeId } from '@cringe-court/core';
import { Amount } from '@/ds';
import { t } from '@/i18n';
import styles from './pages.module.css';

const minutes = (s: number) => t('shell.facts.minutes', { count: Math.round(s / 60) });
const hours = (s: number) => t('shell.facts.hours', { count: Math.round(s / 3600) });

/** The numbers that matter before paying (V4 §6.2), straight from the core constants. */
export function ModeFacts({ id, detailed = false }: { id: ModeId; detailed?: boolean }) {
  const mode = MODES[id];
  const { economics, deadlines, ballot } = mode;
  return (
    <dl className={styles.facts}>
      <div>
        <dt>{t('shell.facts.jury')}</dt>
        <dd>
          {t('shell.facts.juryValue', { size: jurySize(mode), threshold: verdictThreshold(mode) })}
        </dd>
      </div>
      <div>
        <dt>{t('shell.facts.ballot')}</dt>
        <dd>
          {ballot[0]} / {ballot[1]}
        </dd>
      </div>
      <div>
        <dt>{t(mode.funding.kind === 'split' ? 'shell.facts.charge.both' : mode.funding.kind === 'crowdfund' ? 'shell.facts.charge.crowdfund' : 'shell.facts.charge.single')}</dt>
        <dd>
          <Amount value={caseCharge(mode)} size="sm" />
        </dd>
      </div>
      {detailed && (
        <>
          <div>
            <dt>{t('shell.facts.bond')}</dt>
            <dd>
              <Amount value={economics.bondPerJuror} size="sm" />
            </dd>
          </div>
          <div>
            <dt>{t('shell.facts.reward')}</dt>
            <dd>
              <Amount value={economics.successBonusPerJuror} size="sm" />
            </dd>
          </div>
          <div>
            <dt>{t('shell.facts.deadlines')}</dt>
            <dd>
              {[
                ...(deadlines.preTrial !== null ? [t(id === 'versus' ? 'shell.facts.deadline.consent' : 'shell.facts.deadline.funding', { time: hours(deadlines.preTrial) })] : []),
                t('shell.facts.deadline.jury', { time: minutes(deadlines.recruitment) }),
                t('shell.facts.deadline.seal', { time: minutes(deadlines.commit) }),
                t('shell.facts.deadline.reveal', { time: minutes(deadlines.reveal) }),
              ].join(t('shell.facts.join'))}
            </dd>
          </div>
        </>
      )}
    </dl>
  );
}
