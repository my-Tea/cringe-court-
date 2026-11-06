import * as RadixTooltip from '@radix-ui/react-tooltip';
import type { ReactElement, ReactNode } from 'react';
import styles from './Tooltip.module.css';

export const TooltipProvider = RadixTooltip.Provider;

export interface TooltipProps {
  content: ReactNode;
  /** A single focusable element (a Button, a link …). */
  children: ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * Supplementary hints only: never put the only copy of important information
 * (a price, a loss condition) in a tooltip. Opens on hover and keyboard focus.
 */
export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content side={side} sideOffset={6} className={styles.content} collisionPadding={8}>
          {content}
          <RadixTooltip.Arrow className={styles.arrow} width={10} height={5} />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
