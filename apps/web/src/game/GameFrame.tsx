import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { cx, Icon, PaperButton, TestnetBadge, usePageEnter } from '@/ds';
import { paths } from '@/app/routes';
import { t } from '@/i18n';
import { SoundButton } from '@/platform/SoundSettings';
import { MENU_SCREENS, type GameView } from './state';
import styles from './Game.module.css';

const MENU_PATHS = new Set<string>([paths.menu, ...MENU_SCREENS.map((s) => s.to)]);

/**
 * The frame every non-world screen sits in. A panel floats over the frozen
 * world (the menu, its screens, every filing step); a scene fills the screen
 * (a hearing). Both carry the way back to the game and the menu, and nothing
 * else: no site header, no nav bar.
 *
 * Escape steps back on the menu's own screens only. On a filing step it does
 * nothing, so a stray key never throws away a half-written story.
 */
export function GameFrame({ view, children }: { view: Exclude<GameView, 'title' | 'world'>; children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  const onMenu = pathname === paths.menu;
  const inMenu = MENU_PATHS.has(pathname);
  usePageEnter(main, pathname);

  // Focus moves into the new screen (screen readers start there; keys work at once).
  useEffect(() => {
    const auto = main.current?.querySelector<HTMLElement>('[data-autofocus]');
    (auto ?? main.current)?.focus({ preventScroll: true });
    main.current?.scrollTo?.({ top: 0 });
  }, [pathname]);

  useEffect(() => {
    if (!inMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // Dialogs and menus inside the page handle their own Escape first.
      if ((e.target as HTMLElement | null)?.closest('[role="dialog"]')) return;
      e.preventDefault();
      navigate(onMenu ? paths.play : paths.menu);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inMenu, onMenu, navigate]);

  return (
    <div className={cx(styles.frame, view === 'scene' ? styles.scene : styles.panel)}>
      <header className={styles.frameBar}>
        <PaperButton variant="gold" size="sm" iconStart={<Icon name="gamepad" />} onClick={() => navigate(paths.play)}>
          {t('game.frame.back')}
        </PaperButton>
        {!inMenu ? <span className={styles.frameLabel}>{t('game.frame.clerk')}</span> : <span />}
        <div className={styles.frameEnd}>
          <TestnetBadge />
          <SoundButton />
          {onMenu ? null : (
            <PaperButton variant="maroon" size="sm" iconStart={<Icon name="menu" />} onClick={() => navigate(paths.menu)}>
              {t('game.frame.menu')}
            </PaperButton>
          )}
        </div>
      </header>
      <main ref={main} id="main" tabIndex={-1} className={styles.frameBody}>
        {/* Menu screens are their own cards; every other screen sits on a sheet of parchment over the world. */}
        <div className={inMenu ? styles.menuWrap : styles.sheet}>{children}</div>
      </main>
    </div>
  );
}
