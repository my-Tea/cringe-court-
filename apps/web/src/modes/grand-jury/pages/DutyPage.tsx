import { ZERO_USDC, addUsdc, formatUsdc, type Usdc } from '@cringe-court/core';
import type { CaseDetail } from '@cringe-court/modes-grand-jury';
import { Link } from 'react-router';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { Amount, Countdown, EmptyState, ErrorState, Icon, PaperButtonLink, PaperPanel, PaperRibbon, Skeleton, type IconName } from '@/ds';
import { BallotChip, StatusBadge } from '../components/parts';
import { deadlineLabel, paths } from '../lib';
import { useAllCases, useCourtNowMs, useWallet } from '../state/hooks';
import styles from '../GrandJury.module.css';

interface Todo {
  detail: CaseDetail;
  icon: IconName;
  title: string;
  body: string;
  cta: string;
  urgent: boolean;
}

/** What the viewer has to do next, most urgent first. Missing a ballot window is the only way to lose a bond. */
function todosOf(cases: readonly CaseDetail[]): Todo[] {
  const out: Todo[] = [];
  for (const d of cases) {
    const v = d.viewer;
    if (v.offer) out.push({ detail: d, icon: 'gavel', title: 'A jury seat is offered to you', body: `Accept to post a ${formatUsdc(d.terms.bondPerJuror)} bond, or decline for free.`, cta: 'Answer the offer', urgent: true });
    if (v.seat !== null && d.phase === 'commit' && !v.committed) out.push({ detail: d, icon: 'lock', title: `Seal your ballot (seat ${v.seat})`, body: 'Your bond is forfeited if you miss this window.', cta: 'Seal my ballot', urgent: true });
    if (v.seat !== null && d.phase === 'reveal' && v.committed && !v.revealed) out.push({ detail: d, icon: 'unlock', title: `Open your scroll (seat ${v.seat})`, body: 'Unopened scrolls are not counted and the bond is forfeited.', cta: 'Open my scroll', urgent: true });
    if (d.phase === 'finalizing' && (v.seat !== null || v.contributed > 0n)) out.push({ detail: d, icon: 'scales', title: 'Ready to settle', body: 'Every deadline has passed. Anyone can settle it, including you.', cta: 'Settle the case', urgent: false });
    if (v.claim && !v.claim.claimed && v.claim.amount > 0n) out.push({ detail: d, icon: 'sparkle', title: `Collect ${formatUsdc(v.claim.amount)}`, body: v.claim.lines.some((l) => l.kind === 'refund') ? 'Your refund is waiting.' : 'Your bond and reward are waiting.', cta: 'Collect', urgent: false });
  }
  return out.sort((a, b) => Number(b.urgent) - Number(a.urgent) || (a.detail.phaseEndsAt ?? Infinity) - (b.detail.phaseEndsAt ?? Infinity));
}

function involved(d: CaseDetail): boolean {
  const v = d.viewer;
  return v.seat !== null || v.contributed > 0n || v.isSponsor || v.galleryVote !== null || v.offer !== null || v.claim !== null;
}

function CaseRow({ d, nowMs, children }: { d: CaseDetail; nowMs: number; children?: React.ReactNode }) {
  return (
    <li className={styles.dutyRow}>
      <div className={styles.dutyRowMain}>
        <span className={styles.caseLabel}>{d.label}</span>
        <Link to={paths.case(d.caseNumber)} className={styles.dutyRowLink}>
          {d.file.question}
        </Link>
        <div className={styles.dutyRowMeta}>
          <StatusBadge status={d.status} />
          {children}
        </div>
      </div>
      {d.phaseEndsAt !== null && d.phaseStartedAt !== null && (
        <Countdown compact label={deadlineLabel(d)} startsAt={d.phaseStartedAt * 1000} endsAt={d.phaseEndsAt * 1000} now={nowMs} className={styles.dutyRowClock} />
      )}
    </li>
  );
}

function Section({ id, title, icon, children }: { id: string; title: string; icon: IconName; children: React.ReactNode }) {
  return (
    <PaperPanel as="section" tone="cream" edge="cut" padding="md" aria-labelledby={id} className={styles.dutySection}>
      <h2 id={id} className={styles.panelTitle}>
        <Icon name={icon} className={styles.panelTitleIcon} /> {title}
      </h2>
      {children}
    </PaperPanel>
  );
}

/** "My court": the viewer's seats, summons, gallery calls and money across the whole docket. */
export function DutyPage() {
  useDocumentTitle('My court');
  const cases = useAllCases();
  const wallet = useWallet();
  const nowMs = useCourtNowMs();

  if (cases.state === 'loading') {
    return (
      <div className={styles.page} aria-busy="true">
        <p className="cc-visually-hidden" role="status">
          Loading your court…
        </p>
        <Skeleton height="6rem" />
        <Skeleton height="14rem" />
      </div>
    );
  }
  if (cases.state === 'error') {
    return (
      <div className={styles.page}>
        <ErrorState title="Your court would not load" headingLevel={1} onRetry={cases.retry} details={cases.error.message}>
          We couldn’t read your cases from the ledger.
        </ErrorState>
      </div>
    );
  }

  const mine = cases.data.filter(involved);
  const todos = todosOf(cases.data);
  const seats = mine.filter((d) => d.viewer.seat !== null);
  const summoned = mine.filter((d) => d.viewer.contributed > 0n || d.viewer.isSponsor);
  const calls = mine.filter((d) => d.viewer.galleryVote !== null);
  const contributed: Usdc = addUsdc(ZERO_USDC, ...mine.map((d) => d.viewer.contributed));
  const collected: Usdc = addUsdc(ZERO_USDC, ...mine.filter((d) => d.viewer.claim?.claimed).map((d) => d.viewer.claim!.amount));
  const waiting: Usdc = addUsdc(ZERO_USDC, ...mine.filter((d) => d.viewer.claim && !d.viewer.claim.claimed).map((d) => d.viewer.claim!.amount));
  const balance = wallet.state === 'ready' ? wallet.data.balance : null;

  return (
    <div className={styles.page}>
      <header className={styles.docketHero}>
        <PaperRibbon as="h1" tone="maroon" size="lg" sparks className={styles.heroRibbon}>
          My court
        </PaperRibbon>
        <p className={styles.heroLede}>Your seats, your summons and your calls from the gallery, with every deadline that matters to you.</p>
      </header>

      <ul className={styles.statRow} aria-label="Your numbers">
        <PaperPanel as="li" tone="gold" edge="cut" padding="sm" className={styles.stat}>
          <p className={styles.statLabel}>Test wallet</p>
          <p className={styles.statValue}>{balance === null ? '…' : <Amount value={balance} size="lg" />}</p>
        </PaperPanel>
        <PaperPanel as="li" tone="cream" edge="cut" padding="sm" className={styles.stat}>
          <p className={styles.statLabel}>Seats held</p>
          <p className={styles.statNum}>{seats.length}</p>
        </PaperPanel>
        <PaperPanel as="li" tone="cream" edge="cut" padding="sm" className={styles.stat}>
          <p className={styles.statLabel}>Chipped in</p>
          <p className={styles.statValue}>
            <Amount value={contributed} size="lg" />
          </p>
        </PaperPanel>
        <PaperPanel as="li" tone="cream" edge="cut" padding="sm" className={styles.stat}>
          <p className={styles.statLabel}>Collected / waiting</p>
          <p className={styles.statValue}>
            <Amount value={collected} size="lg" /> <span className={styles.statSub}>/ {formatUsdc(waiting)}</span>
          </p>
        </PaperPanel>
      </ul>

      {mine.length === 0 && todos.length === 0 ? (
        <EmptyState
          title="You haven’t joined a case yet"
          character="juror"
          actions={
            <PaperButtonLink to={paths.docket} iconEnd={<Icon name="arrow-right" />}>
              Browse the docket
            </PaperButtonLink>
          }
        >
          Chip in to summon a court, volunteer for a jury seat, or call it from the gallery. Everything you do shows up here.
        </EmptyState>
      ) : (
        <>
          <Section id="todo-title" title={todos.length ? `Needs you (${todos.length})` : 'Nothing needs you right now'} icon="alert">
            {todos.length === 0 ? (
              <p className={styles.panelLede}>No open offers, ballots or claims. We’ll list them here the moment one needs you.</p>
            ) : (
              <ul className={styles.todos}>
                {todos.map((t) => (
                  <li key={`${t.detail.caseNumber}-${t.title}`} className={styles.todo} data-urgent={t.urgent || undefined}>
                    <span className={styles.todoIcon} aria-hidden>
                      <Icon name={t.icon} />
                    </span>
                    <div className={styles.todoText}>
                      <p className={styles.todoTitle}>
                        {t.title} <span className={styles.caseLabel}>{t.detail.label}</span>
                      </p>
                      <p className={styles.todoBody}>{t.body}</p>
                    </div>
                    {t.detail.phaseEndsAt !== null && t.detail.phaseStartedAt !== null && t.urgent && (
                      <Countdown compact label={deadlineLabel(t.detail)} startsAt={t.detail.phaseStartedAt * 1000} endsAt={t.detail.phaseEndsAt * 1000} now={nowMs} />
                    )}
                    <PaperButtonLink to={paths.case(t.detail.caseNumber)} size="sm" variant={t.urgent ? 'maroon' : 'gold'} iconEnd={<Icon name="arrow-right" />}>
                      {t.cta}
                    </PaperButtonLink>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {seats.length > 0 && (
            <Section id="seats-title" title="Jury seats" icon="gavel">
              <ul className={styles.dutyList}>
                {seats.map((d) => (
                  <CaseRow key={d.caseNumber} d={d} nowMs={nowMs}>
                    <span className={styles.dutyNote}>
                      Seat {d.viewer.seat} · {d.viewer.revealed ? 'scroll opened' : d.viewer.committed ? 'ballot sealed' : 'sworn in'}
                    </span>
                  </CaseRow>
                ))}
              </ul>
            </Section>
          )}

          {summoned.length > 0 && (
            <Section id="summoned-title" title="Cases you summoned" icon="sparkle">
              <ul className={styles.dutyList}>
                {summoned.map((d) => (
                  <CaseRow key={d.caseNumber} d={d} nowMs={nowMs}>
                    <span className={styles.dutyNote}>{d.viewer.isSponsor ? 'Sponsor' : `You chipped in ${formatUsdc(d.viewer.contributed)}`}</span>
                  </CaseRow>
                ))}
              </ul>
            </Section>
          )}

          {calls.length > 0 && (
            <Section id="calls-title" title="Your calls from the gallery" icon="megaphone">
              <ul className={styles.dutyList}>
                {calls.map((d) => (
                  <CaseRow key={d.caseNumber} d={d} nowMs={nowMs}>
                    <BallotChip bench={d.viewer.galleryVote!} size="sm">
                      {d.ballot[d.viewer.galleryVote!]}
                    </BallotChip>
                    {d.verdict && d.verdict.kind !== 'no-verdict' && (
                      <span className={styles.dutyNote}>{(d.verdict.kind === 'ballot-0' ? 0 : 1) === d.viewer.galleryVote ? 'You called it' : 'The jury saw it differently'}</span>
                    )}
                  </CaseRow>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
