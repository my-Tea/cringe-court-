import { CATEGORIES, formatUsdc } from '@cringe-court/core';
import { parseCaseParam, type CaseDetail } from '@cringe-court/modes-grand-jury';
import { Link, useParams } from 'react-router';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { Countdown, EmptyState, ErrorState, Icon, PaperButtonLink, PaperPanel, PhaseStepper, Skeleton, SkeletonText } from '@/ds';
import { ArgumentFeed, CourtRecord } from '../components/ArgumentFeed';
import { CaseSounds } from '../components/CaseSounds';
import { DemoControls } from '../components/DemoControls';
import { ClaimPanel, FundingPanel, GalleryPanel, JurorPanel } from '../components/panels';
import { Benches, CourtPanel, StatusBadge } from '../components/parts';
import { SharePanel } from '../components/SharePanel';
import { TrialView } from '../components/TrialView';
import { VerdictPanel } from '../components/VerdictPanel';
import { STEPS, deadlineLabel, isClosed, paths, stepOf } from '../lib';
import { useCase, useCourtNow } from '../state/hooks';
import styles from '../GrandJury.module.css';

const SOURCE_ICON = { definition: 'book', poll: 'users', history: 'clock', quote: 'megaphone', rule: 'scales' } as const;

function CaseContext({ detail }: { detail: CaseDetail }) {
  const f = detail.file;
  return (
    <CourtPanel id="context-title" tone="cream" edge="clean" eyebrow="Reviewed context card" title="The facts both sides agree on" icon="book">
      <p className={styles.contextText}>{f.context}</p>
      {f.sources.length > 0 && (
        <ul className={styles.sources} aria-label="Exhibits">
          {f.sources.map((s) => (
            <li key={s.id} className={styles.source}>
              <span className={styles.sourceTag}>
                <Icon name={SOURCE_ICON[s.kind]} /> Exhibit {s.id}
              </span>
              <span className={styles.sourceLabel}>{s.label}</span>
              <span className={styles.sourceNote}>{s.note}</span>
            </li>
          ))}
        </ul>
      )}
      <details className={styles.breakdown}>
        <summary>
          <Icon name="shield" /> Editorial review
        </summary>
        <p>
          Signed off by {f.review.editor} on {f.review.signedOff} after {f.review.minutes} minutes. Grand Jury cases are about public issues, never private people.
        </p>
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
    <CourtPanel id="summoners-title" tone="kraft" elevation={1} eyebrow="Cosmetic credit · same whatever the verdict" title={`${detail.summoners} ${detail.summoners === 1 ? 'Summoner' : 'Summoners'}`} icon="crown">
      {detail.sponsor && (
        <p className={styles.sponsorLine}>
          <Icon name="star" /> {detail.sponsor.line} <span className={styles.sponsorAmount}>({formatUsdc(detail.sponsor.amount)} sponsor commitment)</span>
        </p>
      )}
      <ul className={styles.summoners}>
        {detail.summonerList.map((s) => (
          <li key={s.label} className={styles.summoner} data-you={s.isViewer || undefined}>
            <span className={styles.summonerName}>{s.label}</span>
            <span className={styles.summonerAmount}>{formatUsdc(s.amount, { unit: false })}</span>
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
        <span className={styles.caseCategory}>{CATEGORIES[detail.file.category]}</span>
      </div>
      <p className={styles.caseEyebrow}>{detail.file.title}</p>
      <h1 className={styles.caseQuestion}>{detail.file.question}</h1>
      <p className={styles.caseHook}>{detail.file.hook}</p>
      {detail.sponsor && (
        <p className={styles.presentedBy}>
          <Icon name="star" /> Presented by {detail.sponsor.name}. The sponsor has no say over the case, the arguments or the verdict.
        </p>
      )}
      <PhaseStepper steps={STEPS} current={stepOf(detail.status)} label="Case progress" className={styles.caseStepper} />
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
        Loading the case…
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

/** Everything about one public case: the hearing, the jury, the money and the verdict. */
export function CasePage() {
  const { caseNumber } = useParams();
  const n = parseCaseParam(caseNumber);
  const c = useCase(n);
  const now = useCourtNow();
  const detail = c.state === 'ready' ? c.data : null;
  useDocumentTitle(detail ? `${detail.label}: ${detail.file.question}` : 'Grand Jury case');

  if (n === null || (c.state === 'ready' && !detail)) {
    return (
      <div className={styles.page}>
        <EmptyState
          title="No such case on the docket"
          character="bailiff"
          expression="shocked"
          headingLevel={1}
          actions={
            <PaperButtonLink to={paths.docket} iconStart={<Icon name="arrow-left" />}>
              Back to the docket
            </PaperButtonLink>
          }
        >
          {caseNumber ? `There is no Grand Jury case “${caseNumber}”.` : 'That link is missing a case number.'} It may have been mistyped.
        </EmptyState>
      </div>
    );
  }
  if (c.state === 'loading') return <CaseSkeleton />;
  if (c.state === 'error') {
    return (
      <div className={styles.page}>
        <ErrorState title="This case would not load" headingLevel={1} onRetry={c.retry} details={c.error.message}>
          We couldn’t read it from the ledger. Nothing was charged.
        </ErrorState>
      </div>
    );
  }
  const d = detail!;
  const closed = isClosed(d.status);

  return (
    <div className={styles.page}>
      <nav aria-label="Breadcrumb" className={styles.crumbs}>
        <Link to={paths.docket}>
          <Icon name="arrow-left" /> Docket
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
          <TrialView detail={d} />
          <ArgumentFeed detail={d} />
          <CaseContext detail={d} />
        </div>
        <aside className={styles.caseAside} aria-label="Take part">
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
