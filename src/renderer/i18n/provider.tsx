import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { rendererLanguagePackRegistry, type LanguagePackRegistry } from './registry';
import { defaultLocale, preferredLocaleStorageKey, type I18nValue } from './types';

const I18nContext = createContext<I18nValue | null>(null);

interface I18nProviderProps {
  children: ReactNode;
  locale?: string;
  registry?: LanguagePackRegistry;
}

interface ResolveInitialLocaleInput {
  locale?: string;
  registry?: LanguagePackRegistry;
}

const getStoredLocale = (): string | null => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage.getItem(preferredLocaleStorageKey);
};

export const resolveInitialLocale = ({
  locale,
  registry = rendererLanguagePackRegistry
}: ResolveInitialLocaleInput): string => {
  const explicitLocale = locale && registry.get(locale)?.locale;
  if (explicitLocale) {
    return explicitLocale;
  }

  const storedLocale = getStoredLocale();
  if (storedLocale && registry.get(storedLocale)) {
    return storedLocale;
  }

  return registry.get(defaultLocale)?.locale ?? defaultLocale;
};

export const I18nProvider = ({
  children,
  locale,
  registry = rendererLanguagePackRegistry
}: I18nProviderProps): JSX.Element => {
  const resolvedInitialLocale = resolveInitialLocale({ locale, registry });
  const [currentLocale, setCurrentLocale] = useState(resolvedInitialLocale);
  const availablePacks = registry.list();
  const availableLocales = availablePacks.map((pack) => pack.locale);
  const localeLabels = Object.fromEntries(availablePacks.map((pack) => [pack.locale, pack.label]));

  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    window.localStorage.setItem(preferredLocaleStorageKey, currentLocale);
  }, [currentLocale]);

  const value = useMemo<I18nValue>(() => {
    const activePack = registry.get(currentLocale) ?? registry.get(defaultLocale);
    const fallbackPack = registry.get(defaultLocale);

    return {
      locale: activePack?.locale ?? defaultLocale,
      availableLocales,
      localeLabels,
      setLocale: (nextLocale) => {
        const nextPack = registry.get(nextLocale);
        setCurrentLocale(nextPack?.locale ?? defaultLocale);
      },
      t: (key) => activePack?.messages[key] ?? fallbackPack?.messages[key] ?? key
    };
  }, [availableLocales, currentLocale, localeLabels, registry]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nValue => {
  const context = useContext(I18nContext);
  if (context) {
    return context;
  }

  const fallbackPack = rendererLanguagePackRegistry.get(defaultLocale);
  return {
    locale: defaultLocale,
    availableLocales: rendererLanguagePackRegistry.list().map((pack) => pack.locale),
    localeLabels: Object.fromEntries(
      rendererLanguagePackRegistry.list().map((pack) => [pack.locale, pack.label])
    ),
    setLocale: () => undefined,
    t: (key) => fallbackPack?.messages[key] ?? key
  };
};
