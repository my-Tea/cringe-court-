import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router';
import { Dialog, DialogContent, DialogTrigger, Icon, IconButton, Logo, PaperNavBar, PaperPanel, PaperTab, RoundIconLink, TestnetBadge, Tooltip } from '@/ds';
import { t } from '@/i18n';
import { COURT_LINKS, NAV_ITEMS, paths } from '../routes';
import styles from './AppShell.module.css';
import { MotionToggle } from './MotionToggle';
import { SoundButton, SoundMuteSwitch } from '@/platform/SoundSettings';

/** Moves focus to <main> after client-side navigation, so screen readers start at the new page. */
function useFocusMainOnNavigate() {
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);
  return mainRef;
}

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useFocusMainOnNavigate();
  const { pathname } = useLocation();
  const close = () => setMenuOpen(false);

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main">
        {t('shell.skip')}
      </a>
      <span className={styles.corner} data-corner="tl" aria-hidden />
      <span className={styles.corner} data-corner="tr" aria-hidden />

      <header className={styles.header}>
        <PaperNavBar
          label={t('shell.nav.label')}
          className={styles.bar}
          start={
            <Link to={paths.home} className={styles.brand}>
              {/* Name from hidden text, not aria-label: the wordmark's drawn letters would not match a label (WCAG 2.5.3). */}
              <span className="cc-visually-hidden">{t('shell.brand.home', { app: t('common.app.name') })}</span>
              <Logo layout="inline" title={null} className={styles.brandWide} />
              <Logo layout="mark" title={null} className={styles.brandMark} />
            </Link>
          }
          end={
            <>
              <Tooltip content={t('shell.testnet.tooltip')}>
                <button type="button" className={styles.badgeButton}>
                  <TestnetBadge />
                </button>
              </Tooltip>
              <SoundButton className={styles.sound} />
              <Tooltip content={t('shell.nav.settings')}>
                <RoundIconLink to={paths.settings} label={t('shell.nav.settings')} icon="gear" className={styles.gear} />
              </Tooltip>
              <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
                <DialogTrigger asChild>
                  <IconButton label={t('shell.menu.open')} icon={<Icon name="menu" />} className={styles.menuButton} />
                </DialogTrigger>
                <DialogContent variant="sheet" title={t('shell.menu.title')}>
                  <ul className={styles.mobileNav} role="list">
                    {NAV_ITEMS.map((item) => {
                      const current = item.activeFor ? item.activeFor(pathname) : false;
                      return (
                        <li key={item.to}>
                          <NavLink to={item.to} end={item.to === paths.home} className={styles.menuLink} onClick={close} {...(current ? { 'aria-current': 'page' as const } : {})}>
                            <Icon name={item.icon} />
                            {t(item.labelKey)}
                          </NavLink>
                        </li>
                      );
                    })}
                  </ul>
                  <h2 className={styles.sheetHeading}>{t('shell.nav.courts')}</h2>
                  <ul className={styles.mobileNav} role="list">
                    {COURT_LINKS.map((c) => (
                      <li key={c.to}>
                        <NavLink to={c.to} className={styles.menuLink} onClick={close}>
                          {t(c.labelKey)}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                  <ul className={styles.mobileNav} role="list">
                    <li>
                      <NavLink to={paths.settings} className={styles.menuLink} onClick={close}>
                        <Icon name="gear" />
                        {t('shell.nav.settings')}
                      </NavLink>
                    </li>
                  </ul>
                  <div className={styles.sheetSection}>
                    <TestnetBadge />
                    <SoundMuteSwitch />
                    <MotionToggle />
                  </div>
                </DialogContent>
              </Dialog>
            </>
          }
        >
          {NAV_ITEMS.map((item) => (
            <PaperTab key={item.to} to={item.to} icon={item.icon} end={item.to === paths.home} {...(item.activeFor ? { activeFor: item.activeFor } : {})}>
              {t(item.labelKey)}
            </PaperTab>
          ))}
        </PaperNavBar>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>

      <PaperPanel as="footer" tone="maroon" edge="cut" elevation={3} backing="gold" padding="lg" className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Logo layout="mark" title={null} className={styles.footerMark} />
            <p className={styles.footerWordmark}>{t('common.app.name')}</p>
            <p>{t('shell.footer.blurb')}</p>
          </div>
          <div>
            <h2 className={styles.footerHeading}>{t('shell.nav.courts')}</h2>
            <ul className={styles.footerList} role="list">
              {COURT_LINKS.map((c) => (
                <li key={c.to}>
                  <Link to={c.to}>{t(c.labelKey)}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className={styles.footerHeading}>{t('shell.footer.more')}</h2>
            <ul className={styles.footerList} role="list">
              <li>
                <Link to={paths.howToPlay}>{t('shell.nav.howToPlay')}</Link>
              </li>
              <li>
                <Link to={paths.leaderboard}>{t('shell.nav.leaderboard')}</Link>
              </li>
              <li>
                <Link to={paths.settings}>{t('shell.nav.settings')}</Link>
              </li>
              <li>
                <Link to={paths.gallery}>{t('shell.nav.gallery')}</Link>
              </li>
            </ul>
            <div className={styles.footerMotion}>
              <MotionToggle />
            </div>
          </div>
          <p className={styles.legal}>{t('shell.footer.legal')}</p>
          <p className={styles.signature}>
            <span>{t('shell.footer.testnetOnly')}</span>
            <span className="cc-diamond" aria-hidden />
            <span>{t('common.app.name')}</span>
            <span className={styles.signatureRule} aria-hidden />
            <span>{t('common.app.tagline')}</span>
          </p>
        </div>
      </PaperPanel>
      <ScrollRestoration />
    </div>
  );
}
