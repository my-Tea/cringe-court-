import type { ReactNode } from 'react';
import type { CharacterId, Expression } from '../../../art/art';
import { cx } from '../../lib/cx';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { Portrait } from '../Portrait/Portrait';
import { Spinner } from '../Spinner/Spinner';
import styles from './States.module.css';

interface StateProps {
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  /** Smaller padding for use inside cards and panels. */
  compact?: boolean;
  /** Heading level for the title, to fit the page outline. */
  headingLevel?: 1 | 2 | 3 | 4;
  /** The cast reacts: who appears, and with which face. */
  character?: CharacterId;
  expression?: Expression;
  className?: string;
}

function Frame({ title, children, actions, compact, headingLevel = 2, character, expression, className, art, ...aria }: StateProps & { art?: ReactNode; role?: string; 'aria-live'?: 'polite'; 'aria-busy'?: boolean }) {
  const H = `h${headingLevel}` as const;
  return (
    <div className={cx(styles.state, compact && styles.compact, className)} {...aria}>
      {art ?? (character && <div className={styles.art}><Portrait character={character} expression={expression} size={compact ? 'lg' : 'xl'} alt="" /></div>)}
      <H className={styles.title}>{title}</H>
      {children && <div className={styles.body}>{children}</div>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

/** Nothing here yet. Always says what to do next. */
export function EmptyState({ character = 'clerk', expression = 'neutral', ...props }: StateProps) {
  return <Frame character={character} expression={expression} {...props} />;
}

/** Waiting on something slow (0G arguments, a transaction). Announced politely. */
export function LoadingState({ title = 'One moment…', character = 'ai-narrator', expression = 'neutral', children, ...props }: Partial<StateProps>) {
  return (
    <Frame role="status" aria-live="polite" aria-busy title={<span className={styles.loadingRow}><Spinner label={null} />{title}</span>} character={character} expression={expression} {...props}>
      {children}
    </Frame>
  );
}

export interface ErrorStateProps extends StateProps {
  onRetry?: () => void;
  retryLabel?: string;
  /** Technical detail for bug reports, collapsed by default. */
  details?: string;
}

/** Something failed. Says what happened, what it means for money, and how to recover. */
export function ErrorState({ character = 'judge', expression = 'shocked', onRetry, retryLabel = 'Try again', details, actions, children, ...props }: ErrorStateProps) {
  return (
    <Frame
      role="alert"
      character={character}
      expression={expression}
      actions={
        (onRetry || actions) && (
          <>
            {onRetry && (
              <Button onClick={onRetry} iconStart={<Icon name="refresh" />}>
                {retryLabel}
              </Button>
            )}
            {actions}
          </>
        )
      }
      {...props}
    >
      {children}
      {details && (
        <details className={styles.details}>
          <summary>Technical details</summary>
          <pre>{details}</pre>
        </details>
      )}
    </Frame>
  );
}
