import { Icon, PaperButtonLink, PaperPanel, PaperRibbon } from '@/ds';
import { paths } from '@/app/routes';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import styles from './pages.module.css';

const COLUMNS = ['Top jurors', 'Most cooked cases', 'Best comebacks'] as const;

const RANKING: ReadonlyArray<{ title: string; body: string }> = [
  { title: 'Jurors', body: 'Planned: verdicts served on time and reveals made.' },
  { title: 'Cases', body: 'Planned: the jury margin, so a clean sweep is the most cooked.' },
  { title: 'Comebacks', body: 'Planned: Versus cases won after trailing.' },
];

export function LeaderboardPage() {
  useDocumentTitle('Leaderboard');
  return (
    <div className={styles.page}>
      <PaperPanel as="section" tone="maroon" edge="cut" elevation={3} backing="gold" padding="lg" unfold>
        <div className={styles.hero}>
          <PaperRibbon as="h1" size="lg" sparks className={styles.heroTitle}>
            Leaderboard
          </PaperRibbon>
          <p className={styles.lede}>The season board, pinned up and waiting for its first names.</p>
        </div>
      </PaperPanel>

      <PaperPanel as="section" tone="kraft" edge="torn" elevation={3} padding="lg" aria-labelledby="board-title">
        <div className={styles.sectionHead}>
          <PaperRibbon as="h2" id="board-title" size="md">
            Season zero
          </PaperRibbon>
        </div>
        <div className={styles.boardGrid}>
          {COLUMNS.map((col) => (
            <PaperPanel key={col} tone="cream" edge="cut" elevation={2} padding="md">
              <div className={styles.boardCol}>
                <h3 className={styles.boardTitle}>{col}</h3>
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
        <p className={styles.boardNote}>Season zero hasn&apos;t started. The board fills in when the first testnet trials close.</p>
      </PaperPanel>

      <PaperPanel as="section" tone="cream" edge="cut" elevation={2} padding="lg" aria-labelledby="rank-title">
        <h2 id="rank-title" className={styles.boardTitle}>
          How ranking will work
        </h2>
        <ul className={styles.rules} role="list">
          {RANKING.map((r) => (
            <li key={r.title}>
              <Icon name="star" className={styles.pillarIcon} />
              <p className={styles.pillarBody}>
                <strong>{r.title}.</strong> {r.body}
              </p>
            </li>
          ))}
        </ul>
      </PaperPanel>

      <div className={styles.cta}>
        <PaperButtonLink to={paths.court} size="lg" iconStart={<Icon name="gavel" />}>
          Pick your court
        </PaperButtonLink>
      </div>
    </div>
  );
}
