import { allKeys, en, lookup, type LocaleMessages, type MessageKey } from './catalog';
import { formatMessage, type MessageParams } from './format';
import { pseudoLocalize } from './pseudo';

/** `en` ships; `en-XA` is the pseudo-locale used to prove nothing is hardcoded. */
export const LOCALES = ['en', 'en-XA'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_STORAGE_KEY = 'cc:locale';

export const isLocale = (v: unknown): v is Locale => typeof v === 'string' && (LOCALES as readonly string[]).includes(v);

let pseudo: LocaleMessages | undefined;
function pseudoCatalog(): LocaleMessages {
  if (!pseudo) {
    const out: Record<string, Record<string, string>> = {};
    for (const key of allKeys(en)) {
      const dot = key.indexOf('.');
      const ns = key.slice(0, dot);
      (out[ns] ??= {})[key.slice(dot + 1)] = pseudoLocalize(lookup(en, key)!);
    }
    pseudo = out as unknown as LocaleMessages;
  }
  return pseudo;
}

const catalogs: Record<Locale, () => LocaleMessages> = { en: () => en, 'en-XA': pseudoCatalog };
/** The language tag Intl formatters use for each locale. */
const intlTag: Record<Locale, string> = { en: 'en', 'en-XA': 'en' };

let active: Locale = DEFAULT_LOCALE;

export const getLocale = (): Locale => active;
export const getIntlLocale = (): string => intlTag[active];

/** Switches the module-level locale. The provider remounts the tree so everything re-renders. */
export function setActiveLocale(locale: Locale): void {
  active = locale;
}

/**
 * Translates a catalog key. Safe to call anywhere at render time (and in
 * event handlers); never at module top level, where it would freeze one locale.
 */
export function t(key: MessageKey, params?: MessageParams): string {
  const message = lookup(catalogs[active](), key) ?? lookup(en, key);
  if (message === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] unknown key ${key}`);
    return key;
  }
  return formatMessage(message, params, intlTag[active]);
}

/** Locale-aware number formatting (amounts, counts). */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(getIntlLocale(), options).format(value);
}

/** Locale-aware date/time formatting. */
export function formatDateTime(value: Date | number, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(getIntlLocale(), options).format(value);
}

/** Locale-aware list joining ("A, B and C"). */
export function formatList(items: readonly string[], options?: Intl.ListFormatOptions): string {
  return new Intl.ListFormat(getIntlLocale(), options).format(items);
}
