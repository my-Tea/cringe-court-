import type { HTMLAttributes, ReactNode } from 'react';
import { Link, NavLink, useLocation, type NavLinkProps } from 'react-router';
import { cx } from '../../lib/cx';
import { Icon, type IconName } from '../Icon/Icon';
import styles from './PaperNav.module.css';

export interface PaperNavBarProps extends HTMLAttributes<HTMLElement> {
  /** Accessible name of the navigation landmark. */
  label: string;
  /** Left of the tabs (a logo). */
  start?: ReactNode;
  /** Right of the tabs (the gold call to action, tools). */
  end?: ReactNode;
  /** The tabs: `PaperTab`s. Rendered as a list. */
  children: ReactNode;
}

/**
 * The maroon paper bar of the reference: a long strip of maroon card folded
 * along its length, carrying gold-outlined paper tabs.
 */
export function PaperNavBar({ label, start, end, children, className, ...rest }: PaperNavBarProps) {
  return (
    <div className={cx(styles.bar, className)} data-surface="wood" {...rest}>
      <span className={styles.layers} aria-hidden>
        <span className={styles.sheet} />
      </span>
      {start && <div className={styles.start}>{start}</div>}
      <nav aria-label={label} className={styles.nav}>
        <ul role="list" className={styles.list}>
          {children}
        </ul>
      </nav>
      {end && <div className={styles.end}>{end}</div>}
    </div>
  );
}

export interface PaperTabProps extends Omit<NavLinkProps, 'className' | 'children' | 'style'> {
  icon?: IconName;
  children: ReactNode;
  className?: string;
  /** Mark active for extra paths (e.g. "The Court" while on a mode page). */
  activeFor?: (pathname: string) => boolean;
  /** Override the router location (defaults to the current pathname). */
  pathname?: string;
}

/** A gold-outlined paper tab. The current page gets a filled gold tab and `aria-current="page"`. */
export function PaperTab({ icon, children, className, activeFor, pathname, ...rest }: PaperTabProps) {
  const location = useLocation();
  const forced = activeFor ? activeFor(pathname ?? location.pathname) : false;
  const content = (
    <>
      {icon && <Icon name={icon} className={styles.icon} />}
      <span className={styles.label}>{children}</span>
    </>
  );
  return (
    <li className={styles.item}>
      {forced ? (
        // NavLink only emits aria-current when its own match succeeds, so a
        // section tab that is current for a child page renders a plain Link.
        <Link {...rest} className={cx(styles.tab, styles.active, className)} aria-current="page">
          {content}
        </Link>
      ) : (
        <NavLink {...rest} className={({ isActive }) => cx(styles.tab, isActive && styles.active, className)}>
          {content}
        </NavLink>
      )}
    </li>
  );
}
