import { useNavigate } from 'react-router';
import { Icon, PaperButton, PaperPanel, PaperRibbon, type IconName } from '@/ds';
import { MENU_SCREENS } from './state';
import { paths } from '@/app/routes';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { t, type MessageKey } from '@/i18n';
import styles from './Game.module.css';

/**
 * The menu entries. `compact` renders them as in-world HUD buttons for the
 * roaming room's pause menu; otherwise as paper buttons for the menu screen.
 */
export function GameMenuItems({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const go = (to: string) => {
    onNavigate?.();
    navigate(to);
  };
  const items = [...MENU_SCREENS, { to: paths.home, label: 'game.menu.quit' as MessageKey, icon: 'close' as IconName }];
  if (compact) {
    return (
      <>
        {items.map((i) => (
          <button key={i.to} type="button" className="ccr-btn ccr-btn--ghost" onClick={() => go(i.to)}>
            {t(i.label)}
          </button>
        ))}
      </>
    );
  }
  return (
    <ul role="list" className={styles.menuList}>
      {items.map((i) => (
        <li key={i.to}>
          <PaperButton variant={i.to === paths.home ? 'ghost' : 'maroon'} fullWidth iconStart={<Icon name={i.icon} />} onClick={() => go(i.to)}>
            {t(i.label)}
          </PaperButton>
        </li>
      ))}
    </ul>
  );
}

/** `/menu`: the pause screen, reached from any panel or hearing (the world has its own, in-place). */
export function MenuScreen() {
  useDocumentTitle(t('game.menu.title'));
  const navigate = useNavigate();
  return (
    <PaperPanel as="section" tone="maroon" edge="cut" elevation={4} backing="gold" padding="lg" unfold className={styles.menu} aria-labelledby="game-menu-title">
      <PaperRibbon as="h1" id="game-menu-title" size="lg" sparks>
        {t('game.menu.title')}
      </PaperRibbon>
      <PaperButton iconStart={<Icon name="gamepad" />} fullWidth onClick={() => navigate(paths.play)} data-autofocus>
        {t('game.menu.resume')}
      </PaperButton>
      <GameMenuItems />
    </PaperPanel>
  );
}
