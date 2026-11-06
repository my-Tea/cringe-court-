import * as RadixTabs from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Tabs.module.css';

export interface TabItem {
  value: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: readonly TabItem[];
  /** Accessible name for the tab list. */
  label: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** `underline` for page sections, `pills` for compact filters. */
  variant?: 'underline' | 'pills';
  className?: string;
}

/** WAI-ARIA tabs on Radix: arrow keys move, Home/End jump, panels are labelled. */
export function Tabs({ items, label, value, defaultValue, onValueChange, variant = 'underline', className }: TabsProps) {
  return (
    <RadixTabs.Root
      className={className}
      value={value}
      defaultValue={defaultValue ?? items[0]?.value}
      onValueChange={onValueChange}
      activationMode="automatic"
    >
      <RadixTabs.List aria-label={label} className={cx(variant === 'underline' ? styles.list : styles.pills)}>
        {items.map((item) => (
          <RadixTabs.Trigger key={item.value} value={item.value} disabled={item.disabled} className={styles.trigger}>
            {item.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map((item) => (
        <RadixTabs.Content key={item.value} value={item.value} className={styles.panel}>
          {item.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
