import { MODE_IDS } from '@cringe-court/core';
import { Icon, PaperButtonLink, PaperPanel, PaperRibbon } from '@/ds';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { t } from '@/i18n';
import { resolveModeLabel, webModes } from '@/modes/registry';
import { MODE_KEYS } from '@/play/keys';
import styles from './Game.module.css';

/** `/cases`: the menu's "My cases": each court's own docket of the player's cases. */
export function CasesScreen() {
  useDocumentTitle(t('game.cases.title'));
  return (
    <PaperPanel as="section" tone="maroon" edge="cut" elevation={4} backing="gold" padding="lg" unfold className={styles.menu} aria-labelledby="game-cases-title">
      <PaperRibbon as="h1" id="game-cases-title" size="lg" sparks>
        {t('game.cases.title')}
      </PaperRibbon>
      <p className={styles.menuLede}>{t('game.cases.lede')}</p>
      <ul role="list" className={styles.menuList}>
        {MODE_IDS.map((id) => {
          const docket = webModes.get(id)?.docket;
          if (!docket) return null;
          return (
            <li key={id}>
              <PaperButtonLink to={docket.to} variant="maroon" fullWidth iconStart={<Icon name="document" />} data-autofocus={id === 'solo' ? true : undefined}>
                {t(MODE_KEYS[id])} · {resolveModeLabel(docket.label)}
              </PaperButtonLink>
            </li>
          );
        })}
      </ul>
    </PaperPanel>
  );
}
