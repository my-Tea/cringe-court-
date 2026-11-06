import { Icon, PaperButtonLink, PaperPanel, PaperRibbon } from '@/ds';
import { paths } from '@/app/routes';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { t, type MessageKey } from '@/i18n';
import styles from './pages.module.css';

const COLUMNS: readonly MessageKey[] = ['shell.leaderboard.col.jurors', 'shell.leaderboard.col.cases', 'shell.leaderboard.col.comebacks'];

const RANKING: ReadonlyArray<{ title: MessageKey; body: MessageKey }> = [
  { title: 'shell.leaderboard.rank.jurors.title', body: 'shell.leaderboard.rank.jurors.body' },
  { title: 'shell.leaderboard.rank.cases.title', body: 'shell.leaderboard.rank.cases.body' },
  { title: 'shell.leaderboard.rank.comebacks.title', body: 'shell.leaderboard.rank.comebacks.body' },
];

export function LeaderboardPage() {
  useDocumentTitle(t('shell.nav.leaderboard'));
  return (
    <div className={styles.page}>
      <PaperPanel as="section" tone="maroon" edge="cut" elevation={3} backing="gold" padding="lg" unfold>
        <div className={styles.hero}>
          <PaperRibbon as="h1" size="lg" sparks className={styles.heroTitle}>
            {t('shell.nav.leaderboard')}
          </PaperRibbon>
          <p className={styles.lede}>{t('shell.leaderboard.lede')}</p>
        </div>
      </PaperPanel>

      <PaperPanel as="section" tone="kraft" edge="torn" elevation={3} padding="lg" aria-labelledby="board-title">
        <div className={styles.sectionHead}>
          <PaperRibbon as="h2" id="board-title" size="md">
            {t('shell.leaderboard.season')}
          </PaperRibbon>
        </div>
        <div className={styles.boardGrid}>
          {COLUMNS.map((col) => (
            <PaperPanel key={col} tone="cream" edge="cut" elevation={2} padding="md">
              <div className={styles.boardCol}>
                <h3 className={styles.boardTitle}>{t(col)}</h3>
                <ul className={styles.slots} role="list" aria-hidden>
                  {[1, 2, 3].map((n) => (
                    <li key={n} className={styles.slot}>
                      <span className={styles.medal}>{n}</span>
                      <span className={styles.slotBar} />
                    </li>
                  ))}
                </ul>
              </div>
            </PaperPanel>
          ))}
        </div>
        <p className={styles.boardNote}>{t('shell.leaderboard.note')}</p>
      </PaperPanel>

      <PaperPanel as="section" tone="cream" edge="cut" elevation={2} padding="lg" aria-labelledby="rank-title">
        <h2 id="rank-title" className={styles.boardTitle}>
          {t('shell.leaderboard.rank.title')}
        </h2>
        <ul className={styles.rules} role="list">
          {RANKING.map((r) => (
            <li key={r.title}>
              <Icon name="star" className={styles.pillarIcon} />
              <p className={styles.pillarBody}>
                <strong>{t('shell.leaderboard.rank.heading', { title: t(r.title) })}</strong> {t(r.body)}
              </p>
            </li>
          ))}
        </ul>
      </PaperPanel>

      <div className={styles.cta}>
        <PaperButtonLink to={paths.court} size="lg" iconStart={<Icon name="gavel" />}>
          {t('shell.courts.pick')}
        </PaperButtonLink>
      </div>
    </div>
  );
}
