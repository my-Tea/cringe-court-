import { ballotLabel, formatAmount } from '@/i18n/domain';
import { parseCaseParam, type CaseDetail } from '@cringe-court/modes-grand-jury';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { Countdown, EmptyState, ErrorState, Icon, PaperButtonLink, PaperPanel, PhaseStepper, Skeleton, SkeletonText } from '@/ds';
import { t } from '@/i18n';
import { beatsFromLines, type PlannedVerdict } from '@/trial/beats';
import { TrialViewFrame } from '@/trial/TrialViewFrame';
import { ArgumentFeed, CourtRecord } from '../components/ArgumentFeed';
import { CaseSounds } from '../components/CaseSounds';
import { DemoControls } from '../components/DemoControls';
import { ClaimPanel, FundingPanel, GalleryPanel, JurorPanel } from '../components/panels';
import { Benches, CourtPanel, StatusBadge } from '../components/parts';
import { SharePanel } from '../components/SharePanel';
import { TrialView } from '../components/TrialView';
import { VerdictPanel } from '../components/VerdictPanel';
import { categoryLabel, deadlineLabel, hearingLines, isClosed, paths, steps, stepOf } from '../lib';
import { useCase, useCourtNow } from '../state/hooks';
import styles from '../GrandJury.module.css';

const SOURCE_ICON = { definition: 'book', poll: 'users', history: 'clock', quote: 'megaphone', rule: 'scales' } as const;

function CaseContext({ detail }: { detail: CaseDetail }) {
  const f = detail.file;
  return (
    <CourtPanel id="context-title" tone="cream" edge="clean" eyebrow={t('grandJury.case.context.eyebrow')} title={t('grandJury.case.context.title')} icon="book">
      <p className={styles.contextText}>{f.context}</p>
      {f.sources.length > 0 && (
        <ul className={styles.sources} aria-label={t('grandJury.case.exhibits')}>
          {f.sources.map((s) => (
            <li key={s.id} className={styles.source}>
              <span className={styles.sourceTag}>
                <Icon name={SOURCE_ICON[s.kind]} /> {t('grandJury.case.exhibit', { id: s.id })}
              </span>
              <span className={styles.sourceLabel}>{s.label}</span>
              <span className={styles.sourceNote}>{s.note}</span>
            </li>
          ))}
        </ul>
      )}
      <details className={styles.breakdown}>
        <summary>
          <Icon name="shield" /> {t('grandJury.case.review.summary')}
        </summary>
        <p>{t('grandJury.case.review.body', { editor: f.review.editor, date: f.review.signedOff, minutes: f.review.minutes })}</p>
        <ul className={styles.checks}>
          {f.review.checks.map((c) => (
            <li key={c}>
              <Icon name="check" /> {c}
            </li>
          ))}
        </ul>
      </details>
    </CourtPanel>
  );
}

function SummonerWall({ detail }: { detail: CaseDetail }) {
  if (detail.summonerList.length === 0 && !detail.sponsor) return null;
  return (
    <CourtPanel
      id="summoners-title"
      tone="kraft"
      elevation={1}
      eyebrow={t('grandJury.case.summoners.eyebrow')}
      title={t('grandJury.case.summoners.title', { count: detail.summoners })}
      icon="crown"
    >
      {detail.sponsor && (
        <p className={styles.sponsorLine}>
          <Icon name="star" /> {detail.sponsor.line}{' '}
          <span className={styles.sponsorAmount}>({t('grandJury.case.summoners.commitment', { amount: formatAmount(detail.sponsor.amount) })})</span>
        </p>
      )}
      <ul className={styles.summoners}>
        {detail.summonerList.map((s) => (
          <li key={s.label} className={styles.summoner} data-you={s.isViewer || undefined}>
            <span className={styles.summonerName}>{s.label}</span>
            <span className={styles.summonerAmount}>{formatAmount(s.amount, { unit: false })}</span>
          </li>
        ))}
      </ul>
    </CourtPanel>
  );
}

function CaseHeader({ detail }: { detail: CaseDetail }) {
  const now = useCourtNow();
  const hasWindow = detail.phaseEndsAt !== null && detail.phaseStartedAt !== null;
  return (
    <PaperPanel as="header" tone="cream" edge="torn" elevation={2} padding="lg" className={styles.caseHeader}>
      <div className={styles.caseHeaderTop}>
        <span className={styles.caseLabelLg}>{detail.label}</span>
        <StatusBadge status={detail.status} />
        <span className={styles.caseCategory}>{categoryLabel(detail.file.category)}</span>
      </div>
      <p className={styles.caseEyebrow}>{detail.file.title}</p>
      <h1 className={styles.caseQuestion}>{detail.file.question}</h1>
      <p className={styles.caseHook}>{detail.file.hook}</p>
      {detail.sponsor && (
        <p className={styles.presentedBy}>
          <Icon name="star" /> {t('grandJury.case.presented', { name: detail.sponsor.name })}
        </p>
      )}
      <PhaseStepper steps={steps()} current={stepOf(detail.status)} label={t('grandJury.case.progress')} className={styles.caseStepper} />
      {(hasWindow || detail.demoTiming) && (
        <div className={styles.caseClock}>
          {hasWindow && <Countdown label={deadlineLabel(detail)} startsAt={detail.phaseStartedAt! * 1000} endsAt={detail.phaseEndsAt! * 1000} now={now * 1000} />}
          <DemoControls detail={detail} />
        </div>
      )}
    </PaperPanel>
  );
}

function CaseSkeleton() {
  return (
    <div className={styles.page} aria-busy="true">
      <p className="cc-visually-hidden" role="status">
        {t('grandJury.case.loading')}
      </p>
      <PaperPanel tone="cream" edge="torn" padding="lg" className={styles.caseHeader}>
        <Skeleton variant="text" width="30%" />
        <Skeleton height="3rem" width="80%" />
        <SkeletonText lines={2} />
      </PaperPanel>
      <div className={styles.caseGridLayout}>
        <Skeleton height="22rem" />
        <Skeleton height="22rem" />
      </div>
    </div>
  );
}

/**
 * The verdict beat, only once the scrolls are open (D11: nothing leaks early).
 * FOR (ballot 0) reads as side A, AGAINST (ballot 1) as side B; the text is the
 * case's own ballot label.
 */
function verdictOf(detail: CaseDetail): PlannedVerdict | undefined {
  const v = detail.verdict;
  if (!v) return undefined;
  if (v.kind === 'no-verdict') return { kind: 'mistrial', text: t('grandJury.case.noVerdictBeat') };
  const i = v.kind === 'ballot-0' ? 0 : 1;
  return { kind: i === 0 ? 'side-a' : 'side-b', text: ballotLabel(detail.ballot[i]).toUpperCase() };
}

/** The hearing: the roaming courtroom from the public gallery (or the jury box for a seated juror), the spotlight stage as fallback. */
function Hearing({ detail }: { detail: CaseDetail }) {
  const juror = detail.viewer.seat !== null;
  const beats = useMemo(
    () => beatsFromLines(hearingLines(detail), verdictOf(detail)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the hearing only changes with the transcript, sentence and verdict
    [detail.caseNumber, detail.transcript, detail.sentence, detail.verdict, detail.ballot],
  );
  return (
    <TrialViewFrame
      classic={<TrialView detail={detail} />}
      roam={{
        beats,
        label: t('grandJury.case.courtroom', { label: detail.label }),
        role: juror ? 'juror' : 'spectator',
        spawn: juror ? 'jury-box' : 'aisle',
        jurors: 7,
        avatar: { model: 'creator', name: t('grandJury.case.you') },
      }}
    />
  );
}

/** Everything about one public case: the hearing, the jury, the money and the verdict. */
export function CasePage() {
  const { caseNumber } = useParams();
  const n = parseCaseParam(caseNumber);
  const c = useCase(n);
  const now = useCourtNow();
  const detail = c.state === 'ready' ? c.data : null;
  useDocumentTitle(detail ? t('grandJury.case.docTitle', { label: detail.label, question: detail.file.question }) : t('grandJury.case.docTitleFallback'));

  if (n === null || (c.state === 'ready' && !detail)) {
    return (
      <div className={styles.page}>
        <EmptyState
          title={t('grandJury.case.missing.title')}
          character="bailiff"
          expression="shocked"
          headingLevel={1}
          actions={
            <PaperButtonLink to={paths.docket} iconStart={<Icon name="arrow-left" />}>
              {t('grandJury.backToDocket')}
            </PaperButtonLink>
          }
        >
          {caseNumber ? t('grandJury.case.missing.withId', { id: caseNumber }) : t('grandJury.case.missing.noId')}
        </EmptyState>
      </div>
    );
  }
  if (c.state === 'loading') return <CaseSkeleton />;
  if (c.state === 'error') {
    return (
      <div className={styles.page}>
        <ErrorState title={t('grandJury.case.error.title')} headingLevel={1} onRetry={c.retry} details={c.error.message}>
          {t('grandJury.case.error.body')}
        </ErrorState>
      </div>
    );
  }
  const d = detail!;
  const closed = isClosed(d.status);

  return (
    <div className={styles.page}>
      <nav aria-label={t('grandJury.case.breadcrumb')} className={styles.crumbs}>
        <Link to={paths.docket}>
          <Icon name="arrow-left" /> {t('grandJury.layout.nav.docket')}
        </Link>
        <span aria-hidden>/</span>
        <span aria-current="page">{d.label}</span>
      </nav>

      <CaseSounds key={d.caseNumber} detail={d} />
      <CaseHeader detail={d} />

      {closed && (
        <div className={styles.verdictRow}>
          <VerdictPanel detail={d} />
          <div className={styles.verdictSide}>
            <ClaimPanel detail={d} />
            <SharePanel entry={d} />
          </div>
        </div>
      )}

      <Benches entry={d} />

      <div className={styles.caseGridLayout}>
        <div className={styles.caseMain}>
          <Hearing detail={d} />
          <ArgumentFeed detail={d} />
          <CaseContext detail={d} />
        </div>
        <aside className={styles.caseAside} aria-label={t('grandJury.case.takePart')}>
          {d.status === 'summoning' && <FundingPanel detail={d} />}
          {!closed && d.status !== 'summoning' && <JurorPanel detail={d} />}
          {!closed && <ClaimPanel detail={d} />}
          <GalleryPanel detail={d} />
          {!closed && <SharePanel entry={d} />}
          <SummonerWall detail={d} />
          <CourtRecord log={d.log} now={now} />
        </aside>
      </div>
    </div>
  );
}
