import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  Icon,
  IconButton,
  Logo,
  PaperNavBar,
  PaperPanel,
  PaperTab,
  RoundIconLink,
  TestnetBadge,
  Tooltip,
} from '@/ds';
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
        Skip to content
      </a>
      <span className={styles.corner} data-corner="tl" aria-hidden />
      <span className={styles.corner} data-corner="tr" aria-hidden />

      <header className={styles.header}>
        <PaperNavBar
          label="Main"
          className={styles.bar}
          start={
            <Link to={paths.home} className={styles.brand} aria-label="CringeCourt home">
              <Logo layout="inline" title={null} className={styles.brandWide} />
              <Logo layout="mark" title={null} className={styles.brandMark} />
            </Link>
          }
          end={
            <>
              <Tooltip content="Arc testnet only. Every amount is test USDC: no real money, ever, in this build.">
                <button type="button" className={styles.badgeButton}>
                  <TestnetBadge />
                </button>
              </Tooltip>
              <SoundButton className={styles.sound} />
              <Tooltip content="Settings">
                <RoundIconLink to={paths.settings} label="Settings" icon="gear" className={styles.gear} />
              </Tooltip>
              <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
                <DialogTrigger asChild>
                  <IconButton label="Open menu" icon={<Icon name="menu" />} className={styles.menuButton} />
                </DialogTrigger>
                <DialogContent variant="sheet" title="Menu">
                  <ul className={styles.mobileNav} role="list">
                    {NAV_ITEMS.map((item) => {
                      const current = item.activeFor ? item.activeFor(pathname) : false;
                      return (
                        <li key={item.to}>
                          <NavLink
                            to={item.to}
                            end={item.to === paths.home}
                            className={styles.menuLink}
                            onClick={close}
                            {...(current ? { 'aria-current': 'page' as const } : {})}
                          >
                            <Icon name={item.icon} />
                            {item.label}
                          </NavLink>
                        </li>
                      );
                    })}
                  </ul>
                  <h2 className={styles.sheetHeading}>Courts</h2>
                  <ul className={styles.mobileNav} role="list">
                    {COURT_LINKS.map((c) => (
                      <li key={c.to}>
                        <NavLink to={c.to} className={styles.menuLink} onClick={close}>
                          {c.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                  <ul className={styles.mobileNav} role="list">
                    <li>
                      <NavLink to={paths.settings} className={styles.menuLink} onClick={close}>
                        <Icon name="gear" />
                        Settings
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
              {item.label}
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
            <p className={styles.footerWordmark}>CringeCourt</p>
            <p>The AI performs. Humans decide. A comedy courtroom with real, verified juries and money flows you can check.</p>
          </div>
          <div>
            <h2 className={styles.footerHeading}>Courts</h2>
            <ul className={styles.footerList} role="list">
              {COURT_LINKS.map((c) => (
                <li key={c.to}>
                  <Link to={c.to}>{c.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className={styles.footerHeading}>More</h2>
            <ul className={styles.footerList} role="list">
              <li>
                <Link to={paths.howToPlay}>How to play</Link>
              </li>
              <li>
                <Link to={paths.leaderboard}>Leaderboard</Link>
              </li>
              <li>
                <Link to={paths.settings}>Settings</Link>
              </li>
              <li>
                <Link to={paths.gallery}>Design gallery</Link>
              </li>
            </ul>
            <div className={styles.footerMotion}>
              <MotionToggle />
            </div>
          </div>
          <p className={styles.legal}>
            Testnet only: every amount is test USDC on Arc testnet. Entertainment, not legal advice; verdicts are a jury&apos;s
            opinion, not facts. Jurors are World-verified humans.
          </p>
          <p className={styles.signature}>
            <span>Testnet only</span>
            <span className="cc-diamond" aria-hidden />
            <span>CringeCourt</span>
            <span className={styles.signatureRule} aria-hidden />
            <span>Your Honor, Bro Is Cooked.</span>
          </p>
        </div>
      </PaperPanel>
      <ScrollRestoration />
    </div>
  );
}
