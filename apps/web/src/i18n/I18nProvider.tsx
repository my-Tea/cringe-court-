import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_LOCALE, isLocale, LOCALE_STORAGE_KEY, setActiveLocale, type Locale } from './runtime';

interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
}

const I18nContext = createContext<I18nContextValue>({ locale: DEFAULT_LOCALE, setLocale: () => {} });

/** `?locale=en-XA` wins (handy for screenshots), then the stored choice, then English. */
function initialLocale(): Locale {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('locale');
    if (isLocale(fromQuery)) return fromQuery;
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    /* storage can be blocked; English it is */
  }
  return DEFAULT_LOCALE;
}

export function I18nProvider({ children, locale: forced }: { children: ReactNode; locale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => forced ?? initialLocale());
  // Set synchronously so the very first render already reads the right catalog.
  setActiveLocale(locale);

  useEffect(() => {
    document.documentElement.lang = locale === 'en-XA' ? 'en' : locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    try {
      if (next === DEFAULT_LOCALE) window.localStorage.removeItem(LOCALE_STORAGE_KEY);
      else window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    setLocaleState(next);
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  // Remount on a locale switch so every t() call, including in memoised
  // components, renders against the new catalog. Switching is rare.
  return (
    <I18nContext.Provider value={value}>
      <Fragment key={locale}>{children}</Fragment>
    </I18nContext.Provider>
  );
}

export function useLocale(): I18nContextValue {
  return useContext(I18nContext);
}
