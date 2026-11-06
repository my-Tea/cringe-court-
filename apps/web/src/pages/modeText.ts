import type { ModeId } from '@cringe-court/core';
import type { MessageKey } from '@/i18n';

/** The web layer's labels for the three courts; core's own `name`/`tagline` stay English domain data. */
export const MODE_NAME_KEY: Readonly<Record<ModeId, MessageKey>> = {
  solo: 'common.mode.solo',
  versus: 'common.mode.versus',
  'grand-jury': 'common.mode.grandJury',
};

export const MODE_TAGLINE_KEY: Readonly<Record<ModeId, MessageKey>> = {
  solo: 'shell.mode.tagline.solo',
  versus: 'shell.mode.tagline.versus',
  'grand-jury': 'shell.mode.tagline.grandJury',
};

/** Short court names for tables and menus ("Solo", "Versus", "Grand Jury"). */
export const COURT_LABEL_KEY: Readonly<Record<ModeId, MessageKey>> = {
  solo: 'shell.nav.courts.solo',
  versus: 'shell.nav.courts.versus',
  'grand-jury': 'shell.nav.courts.grandJury',
};
