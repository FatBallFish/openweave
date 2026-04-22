export interface LanguagePack {
  locale: string;
  label: string;
  messages: Record<string, string>;
}

export interface I18nValue {
  locale: string;
  availableLocales: string[];
  localeLabels: Record<string, string>;
  setLocale: (locale: string) => void;
  t: (key: string) => string;
}

export const defaultLocale = 'zh-CN';
export const preferredLocaleStorageKey = 'openweave.preferred-locale';
