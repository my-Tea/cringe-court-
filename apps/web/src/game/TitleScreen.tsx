import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { Icon, Logo, PaperButton, PaperRibbon, TestnetBadge, type IconName } from '@/ds';
import { paths } from '@/app/routes';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { t, type MessageKey } from '@/i18n';
import { SoundButton } from '@/platform/SoundSettings';
import { useGame } from './state';
import styles from './Game.module.css';

/**
 * `/`: the title screen. The logo and a short menu over the live world, which
 * circles the courthouse behind it. Play glides the camera down into the
 * player's own view: no page load between the menu and the game.
 */
export function TitleScreen() {
  useDocumentTitle(null);
  const navigate = useNavigate();
  const { profile, reset } = useGame();
  const [confirming, setConfirming] = useState(false);
  const menu = useRef<HTMLUListElement>(null);
  const started = !!profile.verified || profile.dressed || !!profile.mode;

  useEffect(() => {
    menu.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  }, [confirming]);

  // Arrow keys move through the menu, the way a pad would.
  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const buttons = [...(menu.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = buttons[(at + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length];
    next?.focus();
    e.preventDefault();
  };

  const items: ReadonlyArray<{ id: string; label: MessageKey; icon: IconName; primary?: boolean; onSelect: () => void }> = confirming
    ? [
        {
          id: 'yes',
          label: 'game.title.newGame.yes',
          icon: 'refresh',
          primary: true,
          onSelect: () => {
            reset();
            setConfirming(false);
            navigate(paths.play);
          },
        },
        { id: 'no', label: 'game.title.newGame.no', icon: 'close', onSelect: () => setConfirming(false) },
      ]
    : [
        { id: 'play', label: started ? 'game.title.continue' : 'game.title.play', icon: 'gamepad', primary: true, onSelect: () => navigate(paths.play) },
        ...(started ? [{ id: 'new', label: 'game.title.newGame' as MessageKey, icon: 'refresh' as IconName, onSelect: () => setConfirming(true) }] : []),
        { id: 'how', label: 'game.title.howToPlay', icon: 'book', onSelect: () => navigate(paths.howToPlay) },
        { id: 'settings', label: 'game.title.settings', icon: 'gear', onSelect: () => navigate(paths.settings) },
      ];

  return (
    <main className={styles.title} id="main">
      <div className={styles.titleCorner}>
        <TestnetBadge />
        <SoundButton />
      </div>
      <header className={styles.titleHead}>
        <h1 className={styles.titleLogo}>
          <Logo layout="stacked" title={t('common.app.name')} />
        </h1>
        <PaperRibbon as="p" size="md" sparks className={styles.titleTagline}>
          {t('game.title.tagline')}
        </PaperRibbon>
      </header>
      <nav aria-label={t('game.title.menu')} className={styles.titleNav}>
        {confirming ? <p className={styles.titleConfirm}>{t('game.title.newGame.confirm')}</p> : null}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- arrow keys roam the buttons inside */}
        <ul ref={menu} role="list" className={styles.titleMenu} onKeyDown={onKeyDown}>
          {items.map((i) => (
            <li key={i.id}>
              <PaperButton variant={i.primary ? 'gold' : 'maroon'} size="lg" fullWidth iconStart={<Icon name={i.icon} />} onClick={i.onSelect}>
                {t(i.label)}
              </PaperButton>
            </li>
          ))}
        </ul>
        <p className={styles.titleHint} aria-hidden>
          {t('game.title.hint')}
        </p>
      </nav>
      <p className={styles.titleFoot}>{t('game.title.testnet')}</p>
    </main>
  );
}
