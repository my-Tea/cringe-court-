import { CATEGORIES, type Category } from '@cringe-court/core';
import { formatAmount } from '@/i18n/domain';
import { CURRENT_PRICING, FILTER_STATUSES, crowdSize, type DocketEntry, type DocketFilter } from '@cringe-court/modes-grand-jury';
import { useDeferredValue, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { t, tRich, type MessageKey } from '@/i18n';
import { EmptyState, ErrorState, Icon, PaperButton, PaperButtonLink, PaperPanel, PaperRibbon, Skeleton, SkeletonText, cx } from '@/ds';
import { CaseCard } from '../components/CaseCard';
import { categoryLabel, paths, steps } from '../lib';
import { useCourtNowMs, useDocket } from '../state/hooks';
import styles from '../GrandJury.module.css';

const FILTERS: readonly { value: DocketFilter; label: MessageKey; hint: MessageKey }[] = [
  { value: 'all', label: 'grandJury.docket.filter.all', hint: 'grandJury.docket.filter.allHint' },
  { value: 'open', label: 'grandJury.docket.filter.open', hint: 'grandJury.docket.filter.openHint' },
  { value: 'live', label: 'grandJury.docket.filter.live', hint: 'grandJury.docket.filter.liveHint' },
  { value: 'closed', label: 'grandJury.docket.filter.closed', hint: 'grandJury.docket.filter.closedHint' },
];

/** Live cases first (soonest deadline), then open ones, then the archive (newest first). */
const RANK: Record<DocketEntry['status'], number> = { 'opening-scrolls': 0, 'in-session': 1, 'settle-ready': 2, seating: 3, summoning: 4, verdict: 5, mistrial: 6, cancelled: 7 };

function sortDocket(list: readonly DocketEntry[]): DocketEntry[] {
  return [...list].sort((a, b) => RANK[a.status] - RANK[b.status] || (a.phaseEndsAt ?? Infinity) - (b.phaseEndsAt ?? Infinity) || b.caseNumber - a.caseNumber);
}

function matches(e: DocketEntry, q: string): boolean {
  if (!q) return true;
  const hay = [e.label, e.file.title, e.file.question, e.file.hook, ...e.ballot, ...e.file.tags, categoryLabel(e.file.category)].join(' ').toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

function isFilter(v: string | null): v is DocketFilter {
  return v === 'all' || v === 'open' || v === 'live' || v === 'closed';
}

function DocketSkeleton() {
  return (
    <ul className={styles.caseGrid} aria-hidden>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <li key={i}>
          <PaperPanel tone="cream" edge="cut" padding="md" className={styles.caseCard}>
            <Skeleton variant="text" width="40%" />
            <Skeleton height="2.5rem" />
            <SkeletonText lines={2} />
            <Skeleton height="1.25rem" width="70%" />
          </PaperPanel>
        </li>
      ))}
    </ul>
  );
}

/** The public docket: every Grand Jury case, filterable, live. */
export function DocketPage() {
  useDocumentTitle(t('grandJury.docket.docTitle'));
  const docket = useDocket();
  const nowMs = useCourtNowMs();
  const [params, setParams] = useSearchParams();
  const filter: DocketFilter = isFilter(params.get('show')) ? (params.get('show') as DocketFilter) : 'all';
  const category = (params.get('topic') as Category | null) ?? null;
  const [query, setQuery] = useState(params.get('q') ?? '');
  const q = useDeferredValue(query.trim());

  const set = (key: string, value: string | null) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (value === null || value === 'all' || value === '') n.delete(key);
        else n.set(key, value);
        return n;
      },
      { replace: true },
    );

  const all = docket.state === 'ready' ? docket.data : null;
  const counts = useMemo(() => {
    const c: Record<DocketFilter, number> = { all: 0, open: 0, live: 0, closed: 0 };
    for (const e of all ?? []) {
      c.all++;
      for (const f of ['open', 'live', 'closed'] as const) if (FILTER_STATUSES[f].includes(e.status)) c[f]++;
    }
    return c;
  }, [all]);
  const visible = useMemo(
    () =>
      sortDocket(
        (all ?? []).filter((e) => (filter === 'all' || FILTER_STATUSES[filter].includes(e.status)) && (category === null || e.file.category === category) && matches(e, q)),
      ),
    [all, filter, category, q],
  );
  const featured = useMemo(() => sortDocket((all ?? []).filter((e) => FILTER_STATUSES.live.includes(e.status) || e.status === 'seating'))[0] ?? null, [all]);
  const p = CURRENT_PRICING;

  return (
    <div className={styles.page}>
      <header className={styles.docketHero}>
        <p className={styles.kicker}>
          <Icon name="users" /> {t('grandJury.docket.kicker')}
        </p>
        <PaperRibbon as="h1" tone="maroon" size="lg" sparks className={styles.heroRibbon}>
          {t('grandJury.docket.title')}
        </PaperRibbon>
        <p className={styles.heroLede}>{t('grandJury.docket.lede')}</p>
        <ol className={styles.howStrip} aria-label={t('grandJury.docket.how')}>
          {steps().map((s, i) => (
            <li key={s} className={styles.howStep} style={{ ['--_i' as string]: i }}>
              <span className={styles.howNum} aria-hidden>
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
        <p className={styles.heroFacts}>
          <span>
            {tRich(
              'grandJury.docket.facts.summon',
              { b: (chunk) => <strong>{chunk}</strong> },
              { target: formatAmount(p.target), people: crowdSize(p.target), ticket: formatAmount(p.typicalTicket, { unit: false }) },
            )}
          </span>
          <span aria-hidden>·</span>
          <span>{tRich('grandJury.docket.facts.jurors', { b: (chunk) => <strong>{chunk}</strong> }, { jurors: p.jurors, threshold: p.threshold })}</span>
          <span aria-hidden>·</span>
          <span>{t('grandJury.docket.facts.refund')}</span>
        </p>
      </header>

      {featured && (
        <section aria-labelledby="featured-title" className={styles.featured}>
          <h2 id="featured-title" className={styles.sectionTitle}>
            <Icon name="megaphone" /> {t('grandJury.docket.featured')}
          </h2>
          <div className={styles.featuredCard}>
            <CaseCard entry={featured} nowMs={nowMs} />
          </div>
        </section>
      )}

      <section aria-labelledby="docket-title" className={styles.docketSection}>
        <div className={styles.docketHead}>
          <h2 id="docket-title" className={styles.sectionTitle}>
            <Icon name="document" /> {t('grandJury.docket.section')}
          </h2>
          <div className={styles.search}>
            <label htmlFor="docket-search" className="cc-visually-hidden">
              {t('grandJury.docket.search.label')}
            </label>
            <Icon name="eye" className={styles.searchIcon} />
            <input
              id="docket-search"
              type="search"
              className={styles.searchInput}
              placeholder={t('grandJury.docket.search.placeholder')}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                set('q', e.target.value.trim());
              }}
            />
          </div>
        </div>

        <div className={styles.filters}>
          <div role="group" aria-label={t('grandJury.docket.filter.group')} className={styles.filterGroup}>
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={cx(styles.filterChip, filter === f.value && styles.filterChipOn)}
                aria-pressed={filter === f.value}
                title={t(f.hint)}
                onClick={() => set('show', f.value)}
              >
                {t(f.label)}
                <span className={styles.filterCount}>{all ? counts[f.value] : '–'}</span>
              </button>
            ))}
          </div>
          <div role="group" aria-label={t('grandJury.docket.topic.group')} className={styles.filterGroup}>
            <button type="button" className={cx(styles.topicChip, category === null && styles.topicChipOn)} aria-pressed={category === null} onClick={() => set('topic', null)}>
              {t('grandJury.docket.topic.any')}
            </button>
            {(Object.keys(CATEGORIES) as Category[]).map((c) => (
              <button
                key={c}
                type="button"
                className={cx(styles.topicChip, category === c && styles.topicChipOn)}
                aria-pressed={category === c}
                onClick={() => set('topic', category === c ? null : c)}
              >
                {categoryLabel(c)}
              </button>
            ))}
          </div>
        </div>

        {docket.state === 'loading' && (
          <>
            <p className="cc-visually-hidden" role="status">
              {t('grandJury.docket.loading')}
            </p>
            <DocketSkeleton />
          </>
        )}
        {docket.state === 'error' && (
          <ErrorState title={t('grandJury.docket.error.title')} onRetry={docket.retry} details={docket.error.message}>
            {t('grandJury.docket.error.body')}
          </ErrorState>
        )}
        {all && (
          <>
            <p className={styles.resultCount} role="status" aria-live="polite">
              {visible.length === all.length
                ? t('grandJury.docket.count.all', { count: all.length })
                : t('grandJury.docket.count.some', { visible: visible.length, total: all.length })}
            </p>
            {visible.length > 0 ? (
              <ul className={styles.caseGrid}>
                {visible.map((e) => (
                  <li key={e.caseNumber} className={styles.caseGridItem}>
                    <CaseCard entry={e} nowMs={nowMs} />
                  </li>
                ))}
              </ul>
            ) : all.length === 0 ? (
              <EmptyState
                title={t('grandJury.docket.empty.title')}
                character="clerk"
                actions={<PaperButtonLink to={paths.pricing}>{t('grandJury.docket.empty.action')}</PaperButtonLink>}
              >
                {t('grandJury.docket.empty.body')}
              </EmptyState>
            ) : (
              <EmptyState
                title={t('grandJury.docket.noMatch.title')}
                character="clerk"
                expression="shocked"
                actions={
                  <PaperButton
                    onClick={() => {
                      setQuery('');
                      setParams(new URLSearchParams(), { replace: true });
                    }}
                    iconStart={<Icon name="refresh" />}
                  >
                    {t('grandJury.docket.noMatch.clear')}
                  </PaperButton>
                }
              >
                {q ? t('grandJury.docket.noMatch.query', { q }) : t('grandJury.docket.noMatch.body')}
              </EmptyState>
            )}
          </>
        )}
      </section>
    </div>
  );
}
