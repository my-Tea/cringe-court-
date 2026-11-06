import { CATEGORIES, activeDeadline, formatCaseNumber, type Deadline } from '@cringe-court/core';
import { VERSUS_STEPS, nextStep, stepIndex, type VersusCase, type Viewer } from '@cringe-court/modes-versus';
import { useDeadlineCues } from '@/platform/audio';
import { Badge, Countdown, PhaseStepper, Stamp } from '@/ds';
import { useVersus } from '../runtime/context';
import styles from '../versus.module.css';

const DEADLINE_LABEL: Record<Deadline, string> = {
  consent: 'Side B can answer for',
  funding: 'Both halves due in',
  recruitment: 'Jury selection closes in',
  commit: 'Scrolls must be sealed in',
  reveal: 'Scrolls must be opened in',
  appeal: 'Appeal window',
};

const VIEWER_BADGE: Record<Viewer, { label: string; tone: 'side-a' | 'side-b' | 'highlight' | 'neutral' | 'info' }> = {
  a: { label: 'You are Side A', tone: 'side-a' },
  b: { label: 'You are Side B', tone: 'side-b' },
  juror: { label: 'You are a juror', tone: 'highlight' },
  invitee: { label: 'You are invited', tone: 'info' },
  spectator: { label: 'Watching', tone: 'neutral' },
};

export function CaseHeader({ c, viewer }: { c: VersusCase; viewer: Viewer }) {
  const { now, persona, audio } = useVersus();
  const s = c.state;
  const deadline = activeDeadline(s);
  useDeadlineCues(deadline && deadline.deadline !== 'appeal' ? deadline.endsAt * 1000 : null, now * 1000, audio);
  const step = nextStep(c, viewer, persona.account);
  const span = (d: Deadline) => {
    const t = s.terms.deadlines;
    return d === 'consent' || d === 'funding' ? (t.preTrial ?? 0) : d === 'recruitment' ? t.recruitment : d === 'commit' ? t.commit : d === 'reveal' ? t.reveal : 0;
  };
  const badge = VIEWER_BADGE[viewer];

  return (
    <header className={styles.caseHead}>
      <div className={styles.caseHeadInner}>
        <div className={styles.caseHeadCopy}>
          <p className={styles.eyebrow}>Versus Court · {CATEGORIES[s.filing.category]}</p>
          <h1 className={styles.caseTitle}>“{s.filing.title}”</h1>
          <div className={styles.caseMeta}>
            <Badge tone={badge.tone} solid={viewer === 'a' || viewer === 'b'}>
              {badge.label}
            </Badge>
            <p className={styles.nextStep} data-your-move={step.yourMove || undefined} role="status">
              {step.yourMove && <span className={styles.yourMove}>Your move</span>}
              {step.label}
            </p>
          </div>
        </div>
        <div className={styles.caseHeadAside}>
          {c.caseNumber !== null ? (
            <Stamp tone="case-number" size="sm">
              {formatCaseNumber(c.caseNumber)}
            </Stamp>
          ) : (
            <Stamp tone="filed" size="sm" sub="Private until both pay">
              Filed
            </Stamp>
          )}
          {deadline && deadline.deadline !== 'appeal' && (
            <Countdown label={DEADLINE_LABEL[deadline.deadline]} startsAt={(deadline.endsAt - span(deadline.deadline)) * 1000} endsAt={deadline.endsAt * 1000} now={now * 1000} className={styles.headCountdown} />
          )}
        </div>
      </div>
      <div className={styles.caseStepper}>
        <PhaseStepper steps={VERSUS_STEPS} current={stepIndex(s)} label="Case progress" />
      </div>
    </header>
  );
}
