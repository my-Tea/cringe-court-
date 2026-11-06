import { ZERO_USDC, addUsdc, formatUsdc, type Usdc } from '@cringe-court/core';
import type { CaseDetail } from '@cringe-court/modes-grand-jury';
import { Link } from 'react-router';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { t } from '@/i18n';
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
    if (v.offer) out.push({ detail: d, icon: 'gavel', title: t('grandJury.duty.todo.offer.title'), body: t('grandJury.duty.todo.offer.body', { bond: formatUsdc(d.terms.bondPerJuror) }), cta: t('grandJury.duty.todo.offer.cta'), urgent: true });
    if (v.seat !== null && d.phase === 'commit' && !v.committed) out.push({ detail: d, icon: 'lock', title: t('grandJury.duty.todo.seal.title', { n: v.seat }), body: t('grandJury.duty.todo.seal.body'), cta: t('grandJury.ballot.seal'), urgent: true });
    if (v.seat !== null && d.phase === 'reveal' && v.committed && !v.revealed) out.push({ detail: d, icon: 'unlock', title: t('grandJury.duty.todo.open.title', { n: v.seat }), body: t('grandJury.duty.todo.open.body'), cta: t('grandJury.reveal.open'), urgent: true });
    if (d.phase === 'finalizing' && (v.seat !== null || v.contributed > 0n)) out.push({ detail: d, icon: 'scales', title: t('grandJury.duty.todo.settle.title'), body: t('grandJury.duty.todo.settle.body'), cta: t('grandJury.juror.settle.title'), urgent: false });
    if (v.claim && !v.claim.claimed && v.claim.amount > 0n) out.push({ detail: d, icon: 'sparkle', title: t('grandJury.duty.todo.collect.title', { amount: formatUsdc(v.claim.amount) }), body: v.claim.lines.some((l) => l.kind === 'refund') ? t('grandJury.duty.todo.collect.refund') : t('grandJury.duty.todo.collect.payout'), cta: t('grandJury.duty.todo.collect.cta'), urgent: false });
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
  useDocumentTitle(t('grandJury.layout.nav.duty'));
  const cases = useAllCases();
  const wallet = useWallet();
  const nowMs = useCourtNowMs();

  if (cases.state === 'loading') {
    return (
      <div className={styles.page} aria-busy="true">
        <p className="cc-visually-hidden" role="status">
          {t('grandJury.duty.loading')}
        </p>
        <Skeleton height="6rem" />
        <Skeleton height="14rem" />
      </div>
    );
  }
  if (cases.state === 'error') {
    return (
      <div className={styles.page}>
        <ErrorState title={t('grandJury.duty.error.title')} headingLevel={1} onRetry={cases.retry} details={cases.error.message}>
          {t('grandJury.duty.error.body')}
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
          {t('grandJury.layout.nav.duty')}
        </PaperRibbon>
        <p className={styles.heroLede}>{t('grandJury.duty.lede')}</p>
      </header>

      <ul className={styles.statRow} aria-label={t('grandJury.duty.stats.label')}>
        <PaperPanel as="li" tone="gold" edge="cut" padding="sm" className={styles.stat}>
          <p className={styles.statLabel}>{t('grandJury.layout.wallet.label')}</p>
          <p className={styles.statValue}>{balance === null ? '…' : <Amount value={balance} size="lg" />}</p>
        </PaperPanel>
        <PaperPanel as="li" tone="cream" edge="cut" padding="sm" className={styles.stat}>
          <p className={styles.statLabel}>{t('grandJury.duty.stats.seats')}</p>
          <p className={styles.statNum}>{seats.length}</p>
        </PaperPanel>
        <PaperPanel as="li" tone="cream" edge="cut" padding="sm" className={styles.stat}>
          <p className={styles.statLabel}>{t('grandJury.duty.stats.chipped')}</p>
          <p className={styles.statValue}>
            <Amount value={contributed} size="lg" />
          </p>
        </PaperPanel>
        <PaperPanel as="li" tone="cream" edge="cut" padding="sm" className={styles.stat}>
          <p className={styles.statLabel}>{t('grandJury.duty.stats.collected')}</p>
          <p className={styles.statValue}>
            <Amount value={collected} size="lg" /> <span className={styles.statSub}>/ {formatUsdc(waiting)}</span>
          </p>
        </PaperPanel>
      </ul>

      {mine.length === 0 && todos.length === 0 ? (
        <EmptyState
          title={t('grandJury.duty.empty.title')}
          character="juror"
          actions={
            <PaperButtonLink to={paths.docket} iconEnd={<Icon name="arrow-right" />}>
              {t('grandJury.duty.empty.action')}
            </PaperButtonLink>
          }
        >
          {t('grandJury.duty.empty.body')}
        </EmptyState>
      ) : (
        <>
          <Section id="todo-title" title={todos.length ? t('grandJury.duty.needs', { count: todos.length }) : t('grandJury.duty.nothing')} icon="alert">
            {todos.length === 0 ? (
              <p className={styles.panelLede}>{t('grandJury.duty.nothingBody')}</p>
            ) : (
              <ul className={styles.todos}>
                {todos.map((todo) => (
                  <li key={`${todo.detail.caseNumber}-${todo.title}`} className={styles.todo} data-urgent={todo.urgent || undefined}>
                    <span className={styles.todoIcon} aria-hidden>
                      <Icon name={todo.icon} />
                    </span>
                    <div className={styles.todoText}>
                      <p className={styles.todoTitle}>
                        {todo.title} <span className={styles.caseLabel}>{todo.detail.label}</span>
                      </p>
                      <p className={styles.todoBody}>{todo.body}</p>
                    </div>
                    {todo.detail.phaseEndsAt !== null && todo.detail.phaseStartedAt !== null && todo.urgent && (
                      <Countdown compact label={deadlineLabel(todo.detail)} startsAt={todo.detail.phaseStartedAt * 1000} endsAt={todo.detail.phaseEndsAt * 1000} now={nowMs} />
                    )}
                    <PaperButtonLink to={paths.case(todo.detail.caseNumber)} size="sm" variant={todo.urgent ? 'maroon' : 'gold'} iconEnd={<Icon name="arrow-right" />}>
                      {todo.cta}
                    </PaperButtonLink>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {seats.length > 0 && (
            <Section id="seats-title" title={t('grandJury.duty.seats')} icon="gavel">
              <ul className={styles.dutyList}>
                {seats.map((d) => (
                  <CaseRow key={d.caseNumber} d={d} nowMs={nowMs}>
                    <span className={styles.dutyNote}>
                      {t('grandJury.duty.seatRow', { n: d.viewer.seat ?? 0, state: d.viewer.revealed ? t('grandJury.jury.seat.opened') : d.viewer.committed ? t('grandJury.jury.seat.sealed') : t('grandJury.jury.seat.sworn') })}
                    </span>
                  </CaseRow>
                ))}
              </ul>
            </Section>
          )}

          {summoned.length > 0 && (
            <Section id="summoned-title" title={t('grandJury.duty.summoned')} icon="sparkle">
              <ul className={styles.dutyList}>
                {summoned.map((d) => (
                  <CaseRow key={d.caseNumber} d={d} nowMs={nowMs}>
                    <span className={styles.dutyNote}>{d.viewer.isSponsor ? t('grandJury.duty.sponsor') : t('grandJury.duty.chippedIn', { amount: formatUsdc(d.viewer.contributed) })}</span>
                  </CaseRow>
                ))}
              </ul>
            </Section>
          )}

          {calls.length > 0 && (
            <Section id="calls-title" title={t('grandJury.duty.calls')} icon="megaphone">
              <ul className={styles.dutyList}>
                {calls.map((d) => (
                  <CaseRow key={d.caseNumber} d={d} nowMs={nowMs}>
                    <BallotChip bench={d.viewer.galleryVote!} size="sm">
                      {d.ballot[d.viewer.galleryVote!]}
                    </BallotChip>
                    {d.verdict && d.verdict.kind !== 'no-verdict' && (
                      <span className={styles.dutyNote}>{(d.verdict.kind === 'ballot-0' ? 0 : 1) === d.viewer.galleryVote ? t('grandJury.duty.calledIt') : t('grandJury.duty.differently')}</span>
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
