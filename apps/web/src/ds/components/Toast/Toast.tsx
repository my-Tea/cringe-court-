import * as RadixToast from '@radix-ui/react-toast';
import { t } from '@/i18n';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { Button, IconButton } from '../Button/Button';
import { Icon, type IconName } from '../Icon/Icon';
import styles from './Toast.module.css';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger' | 'verdict';

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
  /** One optional action. `altText` tells screen-reader users how to do it another way. */
  action?: { label: string; altText: string; onClick: () => void };
  /** ms. Defaults to 6000; errors default to 10000 so they can be read. */
  duration?: number;
}

interface ToastRecord extends ToastOptions {
  id: number;
  open: boolean;
}

const icons: Record<ToastTone, IconName> = { info: 'info', success: 'check', warning: 'alert', danger: 'alert', verdict: 'gavel' };

const ToastContext = createContext<((options: ToastOptions) => number) | null>(null);

/**
 * Toasts on Radix: an aria-live region (F8 jumps to it), pause on hover/focus,
 * swipe to dismiss. Errors use `type="foreground"` so they are announced
 * assertively; everything else is polite.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const toast = useCallback((options: ToastOptions) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list.slice(-3), { ...options, id, open: true }]);
    return id;
  }, []);

  const close = (id: number) => setToasts((list) => list.map((r) => (r.id === id ? { ...r, open: false } : r)));
  const remove = (id: number) => setToasts((list) => list.filter((r) => r.id !== id));

  return (
    <ToastContext.Provider value={toast}>
      <RadixToast.Provider swipeDirection="right" label={t('ds.toast.region')}>
        {children}
        {toasts.map(({ id, open, title, description, tone = 'info', action, duration }) => (
          <RadixToast.Root
            key={id}
            open={open}
            onOpenChange={(next) => (next ? undefined : close(id))}
            onAnimationEnd={() => !open && remove(id)}
            type={tone === 'danger' ? 'foreground' : 'background'}
            duration={duration ?? (tone === 'danger' ? 10000 : 6000)}
            className={cx(styles.toast, tone !== 'info' && styles[tone])}
            data-surface="wood"
          >
            <Icon name={icons[tone]} size="1.25rem" className={styles.icon} />
            <div className={styles.text}>
              <RadixToast.Title className={styles.title}>{title}</RadixToast.Title>
              {description && <RadixToast.Description className={styles.description}>{description}</RadixToast.Description>}
            </div>
            <RadixToast.Close asChild>
              <IconButton label={t('ds.toast.dismiss')} icon={<Icon name="close" />} size="sm" className={styles.close} />
            </RadixToast.Close>
            {action && (
              <RadixToast.Action altText={action.altText} asChild>
                <Button size="sm" variant="secondary" className={styles.action} onClick={action.onClick}>
                  {action.label}
                </Button>
              </RadixToast.Action>
            )}
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className={styles.viewport} />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error('useToast must be used inside <ToastProvider>');
  return useMemo(() => ({ toast }), [toast]);
}
