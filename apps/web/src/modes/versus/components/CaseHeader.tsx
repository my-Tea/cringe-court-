import { activeDeadline, type Deadline } from '@cringe-court/core';
import { VERSUS_STEPS, nextStep, stepIndex, type VersusCase, type Viewer } from '@cringe-court/modes-versus';
import { t, type MessageKey } from '@/i18n';
import { useDeadlineCues } from '@/platform/audio';
import { Badge, Countdown, PhaseStepper, Stamp } from '@/ds';
import { useVersus } from '../runtime/context';
import styles from '../versus.module.css';
import { categoryLabel, formatCaseNo, versusStepLabel } from '@/i18n/domain';

const DEADLINE_LABEL: Record<Deadline, MessageKey> = {
  consent: 'versus.header.deadline.consent',
  funding: 'versus.header.deadline.funding',
  recruitment: 'versus.header.deadline.recruitment',
  commit: 'versus.header.deadline.commit',
  reveal: 'versus.header.deadline.reveal',
  appeal: 'versus.header.deadline.appeal',
};

const VIEWER_BADGE: Record<Viewer, { label: MessageKey; tone: 'side-a' | 'side-b' | 'highlight' | 'neutral' | 'info' }> = {
  a: { label: 'versus.header.viewer.a', tone: 'side-a' },
  b: { label: 'versus.header.viewer.b', tone: 'side-b' },
  juror: { label: 'versus.header.viewer.juror', tone: 'highlight' },
  invitee: { label: 'versus.header.viewer.invitee', tone: 'info' },
  spectator: { label: 'versus.header.viewer.spectator', tone: 'neutral' },
};

export function CaseHeader({ c, viewer }: { c: VersusCase; viewer: Viewer }) {
  const { now, persona, audio } = useVersus();
  const s = c.state;
  const deadline = activeDeadline(s);
  useDeadlineCues(deadline && deadline.deadline !== 'appeal' ? deadline.endsAt * 1000 : null, now * 1000, audio);
  const step = nextStep(c, viewer, persona.account);
  const span = (d: Deadline) => {
    const dl = s.terms.deadlines;
    return d === 'consent' || d === 'funding' ? (dl.preTrial ?? 0) : d === 'recruitment' ? dl.recruitment : d === 'commit' ? dl.commit : d === 'reveal' ? dl.reveal : 0;
  };
  const badge = VIEWER_BADGE[viewer];

  return (
    <header className={styles.caseHead}>
      <div className={styles.caseHeadInner}>
        <div className={styles.caseHeadCopy}>
          <p className={styles.eyebrow}>
            {t('common.mode.versus')} · {categoryLabel(s.filing.category)}
          </p>
          <h1 className={styles.caseTitle}>“{s.filing.title}”</h1>
          <div className={styles.caseMeta}>
            <Badge tone={badge.tone} solid={viewer === 'a' || viewer === 'b'}>
              {t(badge.label)}
            </Badge>
            <p className={styles.nextStep} data-your-move={step.yourMove || undefined} role="status">
              {step.yourMove && <span className={styles.yourMove}>{t('versus.header.yourMove')}</span>}
              {step.label}
            </p>
          </div>
        </div>
        <div className={styles.caseHeadAside}>
          {c.caseNumber !== null ? (
            <Stamp tone="case-number" size="sm">
              {formatCaseNo(c.caseNumber)}
            </Stamp>
          ) : (
            <Stamp tone="filed" size="sm" sub={t('versus.header.stamp.sub')}>
              {t('versus.header.stamp.filed')}
            </Stamp>
          )}
          {deadline && deadline.deadline !== 'appeal' && (
            <Countdown
              label={t(DEADLINE_LABEL[deadline.deadline])}
              startsAt={(deadline.endsAt - span(deadline.deadline)) * 1000}
              endsAt={deadline.endsAt * 1000}
              now={now * 1000}
              className={styles.headCountdown}
            />
          )}
        </div>
      </div>
      <div className={styles.caseStepper}>
        <PhaseStepper steps={VERSUS_STEPS.map(versusStepLabel)} current={stepIndex(s)} label={t('versus.header.progress')} />
      </div>
    </header>
  );
}
