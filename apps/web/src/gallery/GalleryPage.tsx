import { useState } from 'react';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { Button, Icon, Switch, useMotion } from '@/ds';
import type { Surface } from '@/ds/tokens';
import {
  BadgeSection,
  BrandSection,
  ButtonSection,
  CardSection,
  CastSection,
  ChromeSection,
  FeedbackSection,
  FormSection,
  OverlaySection,
  StatesSection,
  TabsSection,
} from './Components';
import { PapercraftSection } from './Papercraft';
import { ColorSection, IconSection, MotionSection, SpaceSection, TypeSection } from './Foundations';
import styles from './Gallery.module.css';

const TOC: ReadonlyArray<{ group: string; items: ReadonlyArray<[string, string]> }> = [
  {
    group: 'Foundations',
    items: [
      ['color', 'Color'],
      ['type', 'Typography'],
      ['space', 'Spacing & elevation'],
      ['motion', 'Motion'],
      ['icons', 'Icons'],
    ],
  },
  {
    group: 'Components',
    items: [
      ['papercraft', 'Papercraft'],
      ['buttons', 'Buttons'],
      ['chrome', 'Ornate chrome'],
      ['badges', 'Badges'],
      ['cards', 'Cards'],
      ['forms', 'Form fields'],
      ['overlays', 'Dialogs & toasts'],
      ['tabs', 'Tabs'],
      ['feedback', 'Alerts & loading'],
      ['states', 'Empty / loading / error'],
    ],
  },
  {
    group: 'Courtroom',
    items: [
      ['cast', 'Portraits'],
      ['trial', 'Trial moments'],
    ],
  },
];

/** Storybook-style catalogue of every token, component and state. */
export function GalleryPage() {
  useDocumentTitle('Design gallery');
  const [surface, setSurface] = useState<Surface>('parchment');
  const [replayKey, setReplayKey] = useState(0);
  const { reduced, setPreference } = useMotion();

  return (
    <div className={styles.layout}>
      <nav className={styles.toc} aria-label="Gallery sections">
        {TOC.map((group) => (
          <div key={group.group} className={styles.tocGroup}>
            <p className={styles.tocHeading}>{group.group}</p>
            <ul className={styles.tocList} role="list">
              {group.items.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`}>{label}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div>
        <div className={styles.intro}>
          <p className={styles.toolbarLabel}>CringeCourt design system</p>
          <h1 className={styles.title}>Design gallery</h1>
          <p className={styles.lede}>
            Every token, component and state, live. Switch the surface to see components re-map from parchment to wood, and toggle reduced motion
            to check every animation degrades to an instant state change.
          </p>
        </div>

        <div className={styles.toolbar} role="toolbar" aria-label="Gallery preview settings">
          <div role="group" aria-label="Preview surface" style={{ display: 'flex', gap: 'var(--cc-space-2)' }}>
            {(['parchment', 'wood'] as const).map((s) => (
              <Button key={s} size="sm" variant={surface === s ? 'primary' : 'ghost'} aria-pressed={surface === s} onClick={() => setSurface(s)}>
                {s === 'parchment' ? 'Parchment' : 'Wood'}
              </Button>
            ))}
          </div>
          <Switch label="Reduce motion" checked={reduced} onCheckedChange={(next) => setPreference(next ? 'reduced' : 'full')} />
          <Button size="sm" variant="secondary" iconStart={<Icon name="refresh" />} onClick={() => setReplayKey((k) => k + 1)}>
            Replay animations
          </Button>
        </div>

        <div className={styles.canvas} data-surface={surface}>
          <h2 className={styles.groupTitle}>Foundations</h2>
          <ColorSection surface={surface} />
          <TypeSection />
          <SpaceSection />
          <MotionSection />
          <IconSection />
          <h2 className={styles.groupTitle}>Components</h2>
          <PapercraftSection />
          <ButtonSection />
          <ChromeSection />
          <BadgeSection />
          <CardSection />
          <FormSection />
          <OverlaySection />
          <TabsSection />
          <FeedbackSection />
          <StatesSection />
          <h2 className={styles.groupTitle}>Courtroom</h2>
          <CastSection />
          <BrandSection replayKey={replayKey} />
        </div>
      </div>
    </div>
  );
}
