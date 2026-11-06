// i18n: import from '@/i18n'. See docs/I18N.md.
export { en, allKeys, type MessageKey, type LocaleMessages, type Namespace } from './catalog';
export { formatMessage, messageArgs, type MessageParams } from './format';
export { pseudoLocalize } from './pseudo';
export { t, formatNumber, formatDateTime, formatList, getLocale, LOCALES, DEFAULT_LOCALE, LOCALE_STORAGE_KEY, isLocale, type Locale } from './runtime';
export { tRich } from './rich';
export { I18nProvider, useLocale } from './I18nProvider';
