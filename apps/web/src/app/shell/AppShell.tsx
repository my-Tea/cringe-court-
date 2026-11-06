import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router';
import { Dialog, DialogContent, DialogTrigger, Icon, IconButton, TestnetBadge, Tooltip } from '@/ds';
import { NAV_ITEMS, paths } from '../routes';
import styles from './AppShell.module.css';
import { MotionToggle } from './MotionToggle';

function NavLinks({ className, onNavigate }: { className: string | undefined; onNavigate?: () => void }) {
  return (
    <ul className={className} role="list">
      {NAV_ITEMS.map((item) => (
        <li key={item.to}>
          <NavLink to={item.to} className={styles.navLink} onClick={onNavigate}>
            {item.label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

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

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to={paths.home} className={styles.brand} aria-label="CringeCourt home">
            <Icon name="scales" className={styles.brandMark} />
            CringeCourt
          </Link>
          <nav className={styles.nav} aria-label="Main">
            <NavLinks className={styles.navList} />
          </nav>
          <div className={styles.tools}>
            <Tooltip content="Arc testnet only. Every amount is test USDC: no real money, ever, in this build.">
              <button type="button" className={styles.badgeButton}>
                <TestnetBadge />
              </button>
            </Tooltip>
            <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
              <DialogTrigger asChild>
                <IconButton label="Open menu" icon={<Icon name="menu" />} className={styles.menuButton} />
              </DialogTrigger>
              <DialogContent variant="sheet" title="Menu">
                <nav aria-label="Main">
                  <NavLinks className={styles.mobileNav} onNavigate={() => setMenuOpen(false)} />
                </nav>
                <div className={styles.sheetSection}>
                  <MotionToggle />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer} data-surface="wood">
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <p className={styles.footerWordmark}>
              <Icon name="scales" />
              CringeCourt
            </p>
            <p>The AI performs. Humans decide. A comedy courtroom with real, verified juries and money flows you can check.</p>
          </div>
          <div>
            <h2 className={styles.footerHeading}>Courts</h2>
            <NavLinks className={styles.footerList} />
          </div>
          <div>
            <h2 className={styles.footerHeading}>Settings</h2>
            <MotionToggle />
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
      </footer>
      <ScrollRestoration />
    </div>
  );
}
