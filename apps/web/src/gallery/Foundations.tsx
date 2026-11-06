import { useState } from 'react';
import { ICON_NAMES, Icon, Button } from '@/ds';
import { uiIcon, type UiIconName } from '@/art/art';
import { contrastRatio } from '@/ds/lib/contrast';
import { colorRoles, contrastPairs, duration, easing, palette, paletteGroups, radius, shadow, space, surfaces, type fontSize, type Surface } from '@/ds/tokens';
import styles from './Gallery.module.css';
import { GallerySection, Specimen } from './Specimen';

const ART_ICONS: UiIconName[] = ['accuse', 'bond', 'commit', 'reveal', 'refund', 'slashed', 'journal', 'notebook', 'board', 'endday', 'menu', 'sound'];

export function ColorSection({ surface }: { surface: Surface }) {
  return (
    <GallerySection
      id="color"
      title="Color"
      description="The 30 swatches of the CringeCourt pixel-art style guide are the only colours (docs/STYLE-GUIDE.md). Parchment is the default surface, wood the deep variant. Components use semantic roles only, so a whole subtree re-themes by setting data-surface."
    >
      <Specimen label="Palette" note="docs/assets/style-guide.png · printed hex labels" layout="stack">
        {Object.entries(palette).map(([family, steps]) => (
          <div key={family} className={styles.swatches}>
            <span className={styles.familyLabel}>{paletteGroups[family as keyof typeof palette]}</span>
            {Object.entries(steps).map(([step, value]) => (
              <div key={step} className={styles.swatch}>
                <span className={styles.swatchChip} style={{ background: value }} />
                <span className={styles.swatchMeta}>
                  <span className={styles.swatchName}>
                    {family}-{step}
                  </span>
                  <span className={styles.swatchValue}>{value}</span>
                </span>
              </div>
            ))}
          </div>
        ))}
      </Specimen>
      <Specimen label={`Semantic roles · ${surface}`} note="--cc-color-*">
        <div className={styles.swatches}>
          {colorRoles.map((role) => (
            <div key={role} className={styles.swatch}>
              <span className={styles.swatchChip} style={{ background: `var(--cc-color-${role})` }} />
              <span className={styles.swatchMeta}>
                <span className={styles.swatchName}>{role}</span>
                <span className={styles.swatchValue}>{surfaces[surface][role]}</span>
              </span>
            </div>
          ))}
        </div>
      </Specimen>
      <Specimen label={`WCAG 2.1 AA contrast · ${surface}`} note="enforced by tokens.test.ts">
        <table className={styles.contrastTable}>
          <thead>
            <tr>
              <th scope="col">Sample</th>
              <th scope="col">Use</th>
              <th scope="col">Ratio</th>
              <th scope="col">Needs</th>
            </tr>
          </thead>
          <tbody>
            {contrastPairs.map((pair) => {
              const fg = surfaces[surface][pair.fg];
              const bg = surfaces[surface][pair.bg];
              const ratio = contrastRatio(fg, bg);
              return (
                <tr key={`${pair.fg}-${pair.bg}`}>
                  <td>
                    <span className={styles.contrastSample} style={{ color: fg, background: bg }}>
                      {pair.fg} / {pair.bg}
                    </span>
                  </td>
                  <td>{pair.use}</td>
                  <td className="cc-tabular">{ratio.toFixed(2)}:1</td>
                  <td>
                    {ratio >= pair.min ? '✓' : '✗'} {pair.min}:1
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Specimen>
    </GallerySection>
  );
}

export function TypeSection() {
  const samples: Array<[keyof typeof fontSize, string, string]> = [
    ['5xl', 'display', 'Order in the court'],
    ['4xl', 'display', 'Pick your court'],
    ['3xl', 'display', 'Secret Verdict Scroll'],
    ['2xl', 'display', 'Jury selection'],
    ['xl', 'pixel', 'Case #0069 · in session'],
    ['xl', 'body', 'Counsel Chaos has entered the chat'],
    ['lg', 'body', 'A comedy courtroom where humans decide.'],
    ['md', 'body', 'Every fee, bond and deadline is fixed when the case opens.'],
    ['sm', 'body', 'Jurors may decline a seat without penalty.'],
    ['xs', 'body', 'Testnet only. Test USDC has no value.'],
  ];
  return (
    <GallerySection
      id="type"
      title="Typography"
      description="Fraunces (soft axis) for display, after the style-guide title; Pixelify Sans for pixel accents (eyebrows, badges, stamps); Space Grotesk for reading; JetBrains Mono for money and time. Display sizes are fluid."
    >
      <Specimen label="Type scale" layout="stack">
        {samples.map(([size, family, text]) => (
          <div key={size} className={styles.typeRow}>
            <span className={styles.typeMeta}>
              text-{size} · {family}
            </span>
            <span style={{ fontSize: `var(--cc-text-${size})`, fontFamily: `var(--cc-font-${family})`, lineHeight: 1.2 }}>{text}</span>
          </div>
        ))}
        <div className={styles.typeRow}>
          <span className={styles.typeMeta}>mono · tabular</span>
          <span className="cc-tabular" style={{ fontSize: 'var(--cc-text-2xl)' }}>
            1.20 USDC · 19:59 · 0x7a1c…2e
          </span>
        </div>
      </Specimen>
    </GallerySection>
  );
}

export function SpaceSection() {
  return (
    <GallerySection id="space" title="Spacing, radius & elevation" description="A 4px grid. Rounded radii follow the style-guide frames and tiles. Elevation is warm ink-brown shadow with a hard pixel edge; ring-* are the gold ornate rims; bevel is the inner light/dark edge of a tile.">
      <Specimen label="Space scale" note="--cc-space-*" layout="stack">
        {Object.entries(space)
          .filter(([k]) => k !== 'px' && k !== '0')
          .map(([k, v]) => (
            <div key={k} className={styles.scaleRow}>
              <span>
                space-{k.replace('.', '_')} · {v}
              </span>
              <span className={styles.scaleBar} style={{ width: v }} />
            </div>
          ))}
      </Specimen>
      <Specimen label="Radius" note="--cc-radius-*">
        {Object.entries(radius).map(([k, v]) => (
          <span key={k} className={styles.radiusBox} style={{ borderRadius: v }}>
            {k}
          </span>
        ))}
      </Specimen>
      <Specimen label="Elevation" note="--cc-shadow-*">
        {Object.keys(shadow).map((k) => (
          <span key={k} className={styles.elevationBox} style={{ boxShadow: `var(--cc-shadow-${k})` }}>
            {k}
          </span>
        ))}
      </Specimen>
    </GallerySection>
  );
}

export function MotionSection() {
  const [on, setOn] = useState(false);
  return (
    <GallerySection
      id="motion"
      title="Motion"
      description="Durations and easings are tokens. Under reduced motion every duration collapses to 0ms and loops stop, so state changes still happen, just without travel."
    >
      <Specimen label="Durations × standard easing" layout="stack">
        <Button size="sm" variant="secondary" onClick={() => setOn((v) => !v)}>
          Play
        </Button>
        {Object.keys(duration).map((k) => (
          <div key={k} className={styles.motionDemo}>
            <span>
              duration-{k} · {duration[k as keyof typeof duration]}
            </span>
            <span className={styles.motionTrack} data-on={on}>
              <span className={styles.motionDot} style={{ transitionDuration: `var(--cc-duration-${k})`, transitionTimingFunction: 'var(--cc-ease-standard)' }} />
            </span>
          </div>
        ))}
      </Specimen>
      <Specimen label="Easings × duration-slower" layout="stack">
        {Object.entries(easing).map(([k, v]) => (
          <div key={k} className={styles.motionDemo}>
            <span title={v}>ease-{k}</span>
            <span className={styles.motionTrack} data-on={on}>
              <span className={styles.motionDot} style={{ transitionDuration: 'var(--cc-duration-slower)', transitionTimingFunction: `var(--cc-ease-${k})` }} />
            </span>
          </div>
        ))}
      </Specimen>
    </GallerySection>
  );
}

export function IconSection() {
  return (
    <GallerySection id="icons" title="Icons" description="UI glyphs are drawn on a 12×12 pixel grid in code; domain icons come from the cc-art UI kit.">
      <Specimen label="Pixel glyphs" note="<Icon name />">
        <div className={styles.iconGrid}>
          {ICON_NAMES.map((name) => (
            <span key={name} className={styles.iconCell}>
              <Icon name={name} size="1.5rem" />
              {name}
            </span>
          ))}
        </div>
      </Specimen>
      <Specimen label="Art icons" note="cc-art/dist/ui/icon_*.png · drawn for parchment">
        <div className={styles.iconGrid}>
          {ART_ICONS.map((name) => {
            const art = uiIcon(name);
            return (
              <span key={name} className={styles.iconCell} data-surface="parchment">
                <img src={art.src} srcSet={art.srcSet} alt="" width={32} height={32} data-pixel />
                {name}
              </span>
            );
          })}
        </div>
      </Specimen>
    </GallerySection>
  );
}
