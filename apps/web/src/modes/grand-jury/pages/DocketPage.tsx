import { CATEGORIES, formatUsdc, type Category } from '@cringe-court/core';
import { CURRENT_PRICING, FILTER_STATUSES, crowdSize, type DocketEntry, type DocketFilter } from '@cringe-court/modes-grand-jury';
import { useDeferredValue, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { EmptyState, ErrorState, Icon, PaperButton, PaperButtonLink, PaperPanel, PaperRibbon, Skeleton, SkeletonText, cx } from '@/ds';
import { CaseCard } from '../components/CaseCard';
import { STEPS, paths } from '../lib';
import { useCourtNowMs, useDocket } from '../state/hooks';
import styles from '../GrandJury.module.css';

const FILTERS: readonly { value: DocketFilter; label: string; hint: string }[] = [
  { value: 'all', label: 'All cases', hint: 'Every case on the public docket' },
  { value: 'open', label: 'Open to join', hint: 'Raising money or seating the jury' },
  { value: 'live', label: 'In session', hint: 'The jury is out or opening scrolls' },
  { value: 'closed', label: 'Decided', hint: 'Verdicts, no-verdicts and dismissals' },
];

/** Live cases first (soonest deadline), then open ones, then the archive (newest first). */
const RANK: Record<DocketEntry['status'], number> = {
  'opening-scrolls': 0,
  'in-session': 1,
  'settle-ready': 2,
  seating: 3,
  summoning: 4,
  verdict: 5,
  mistrial: 6,
  cancelled: 7,
};

function sortDocket(list: readonly DocketEntry[]): DocketEntry[] {
  return [...list].sort((a, b) => RANK[a.status] - RANK[b.status] || (a.phaseEndsAt ?? Infinity) - (b.phaseEndsAt ?? Infinity) || b.caseNumber - a.caseNumber);
}

function matches(e: DocketEntry, q: string): boolean {
  if (!q) return true;
  const hay = [e.label, e.file.title, e.file.question, e.file.hook, ...e.ballot, ...e.file.tags, CATEGORIES[e.file.category]].join(' ').toLowerCase();
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
  useDocumentTitle('Grand Jury docket');
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
          <Icon name="users" /> Mode 3 · Public court
        </p>
        <PaperRibbon as="h1" tone="maroon" size="lg" sparks className={styles.heroRibbon}>
          The Grand Jury docket
        </PaperRibbon>
        <p className={styles.heroLede}>
          The internet’s oldest arguments, finally on trial. The crowd chips in to summon the court, seven verified strangers take a bonded seat, two AI lawyers argue it
          out, and the sealed ballots decide.
        </p>
        <ol className={styles.howStrip} aria-label="How a Grand Jury case runs">
          {STEPS.map((s, i) => (
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
            <strong>{formatUsdc(p.target)}</strong> summons a court (about {crowdSize(p.target)} people at {formatUsdc(p.typicalTicket, { unit: false })})
          </span>
          <span aria-hidden>·</span>
          <span>
            <strong>{p.jurors}</strong> jurors, <strong>{p.threshold}</strong> to win
          </span>
          <span aria-hidden>·</span>
          <span>Full refund if it doesn’t happen</span>
        </p>
      </header>

      {featured && (
        <section aria-labelledby="featured-title" className={styles.featured}>
          <h2 id="featured-title" className={styles.sectionTitle}>
            <Icon name="megaphone" /> Happening now
          </h2>
          <div className={styles.featuredCard}>
            <CaseCard entry={featured} nowMs={nowMs} />
          </div>
        </section>
      )}

      <section aria-labelledby="docket-title" className={styles.docketSection}>
        <div className={styles.docketHead}>
          <h2 id="docket-title" className={styles.sectionTitle}>
            <Icon name="document" /> The docket
          </h2>
          <div className={styles.search}>
            <label htmlFor="docket-search" className="cc-visually-hidden">
              Search the docket
            </label>
            <Icon name="eye" className={styles.searchIcon} />
            <input
              id="docket-search"
              type="search"
              className={styles.searchInput}
              placeholder="Search: soup, pineapple, GIF…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                set('q', e.target.value.trim());
              }}
            />
          </div>
        </div>

        <div className={styles.filters}>
          <div role="group" aria-label="Show" className={styles.filterGroup}>
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={cx(styles.filterChip, filter === f.value && styles.filterChipOn)}
                aria-pressed={filter === f.value}
                title={f.hint}
                onClick={() => set('show', f.value)}
              >
                {f.label}
                <span className={styles.filterCount}>{all ? counts[f.value] : '–'}</span>
              </button>
            ))}
          </div>
          <div role="group" aria-label="Topic" className={styles.filterGroup}>
            <button type="button" className={cx(styles.topicChip, category === null && styles.topicChipOn)} aria-pressed={category === null} onClick={() => set('topic', null)}>
              Any topic
            </button>
            {(Object.keys(CATEGORIES) as Category[]).map((c) => (
              <button key={c} type="button" className={cx(styles.topicChip, category === c && styles.topicChipOn)} aria-pressed={category === c} onClick={() => set('topic', category === c ? null : c)}>
                {CATEGORIES[c]}
              </button>
            ))}
          </div>
        </div>

        {docket.state === 'loading' && (
          <>
            <p className="cc-visually-hidden" role="status">
              Loading the docket…
            </p>
            <DocketSkeleton />
          </>
        )}
        {docket.state === 'error' && (
          <ErrorState title="The docket would not open" onRetry={docket.retry} details={docket.error.message}>
            We couldn’t read the cases from the ledger. Nothing was charged.
          </ErrorState>
        )}
        {all && (
          <>
            <p className={styles.resultCount} role="status" aria-live="polite">
              {visible.length === all.length ? `${all.length} cases` : `${visible.length} of ${all.length} cases`}
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
              <EmptyState title="The docket is empty" character="clerk" actions={<PaperButtonLink to={paths.pricing}>How cases get here</PaperButtonLink>}>
                No public cases are published yet. The court editor reviews every case before it goes up.
              </EmptyState>
            ) : (
              <EmptyState
                title="No case matches"
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
                    Clear filters
                  </PaperButton>
                }
              >
                {q ? `Nothing on the docket mentions “${q}”` : 'Nothing in this part of the docket right now'}. Try another filter or topic.
              </EmptyState>
            )}
          </>
        )}
      </section>
    </div>
  );
}
