import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Icon, PaperButtonLink, PaperNavBar, PaperTab, TestnetBadge, useReducedMotion } from '@/ds';
import { NAV_ITEMS, paths } from '@/app/routes';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { CourtroomScene } from './hero/CourtroomScene';
import { LoginPanel } from './LoginPanel';
import styles from './LandingPage.module.css';

/**
 * Pointer and scroll parallax for the hero: writes --px/--py (-1..1) and --sy
 * (0..1) on the frame; the scene's layers move by their depth. Nothing is
 * attached under reduced motion, and the variables reset to zero.
 */
function useParallax(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = (k: string, v: number) => el.style.setProperty(k, v.toFixed(3));
    if (!enabled) {
      ['--px', '--py', '--sy'].forEach((k) => el.style.removeProperty(k));
      return;
    }
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        set('--px', ((e.clientX - r.left) / r.width) * 2 - 1);
        set('--py', ((e.clientY - r.top) / r.height) * 2 - 1);
      });
    };
    const onLeave = () => {
      set('--px', 0);
      set('--py', 0);
    };
    const onScroll = () => {
      const r = el.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
      set('--sy', progress);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', onScroll);
    };
  }, [enabled]);
  return ref;
}

/**
 * The entry route (STYLE-GUIDE §9.10): the maroon sign-in panel on the left,
 * the paper nav bar over the papercraft courtroom on the right. Below 64rem it
 * collapses to one column: nav, courtroom, then the panel.
 */
export function LandingPage() {
  useDocumentTitle(null);
  const reduced = useReducedMotion();
  const heroRef = useParallax(!reduced);

  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#landing-main">
        Skip to sign in
      </a>
      <span className={styles.corner} data-corner="tl" aria-hidden />
      <span className={styles.corner} data-corner="tr" aria-hidden />
      <span className={styles.corner} data-corner="bl" aria-hidden />
      <span className={styles.corner} data-corner="br" aria-hidden />

      <header className={styles.top}>
        <PaperNavBar
          label="Main"
          className={styles.nav}
          end={
            <>
              <TestnetBadge className={styles.testnet} />
              <PaperButtonLink to={paths.court} size="sm" iconStart={<Icon name="gavel" />} className={styles.navCta}>
                Enter court
              </PaperButtonLink>
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

      <main id="landing-main" tabIndex={-1} className={styles.main}>
        <LoginPanel />
      </main>

      <div className={styles.hero} ref={heroRef}>
        <div className={styles.heroFrame}>
          <CourtroomScene className={styles.scene} />
          <span className={styles.grain} aria-hidden />
        </div>
      </div>

      <footer className={styles.footer}>
        <p>
          <strong>Testnet only.</strong> Every amount is test USDC on Arc testnet. Entertainment, not legal advice.
        </p>
        <nav aria-label="More" className={styles.footerLinks}>
          <Link to={paths.howToPlay}>How a trial works</Link>
          <Link to={paths.courtroom}>Demo court</Link>
          <Link to={paths.gallery}>Design gallery</Link>
        </nav>
      </footer>
    </div>
  );
}
