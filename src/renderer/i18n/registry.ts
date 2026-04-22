import { englishLanguagePack } from './packs/en-US';
import { chineseLanguagePack } from './packs/zh-CN';
import type { LanguagePack } from './types';

export interface LanguagePackRegistry {
  register: (pack: LanguagePack) => void;
  unregister: (locale: string) => void;
  get: (locale: string) => LanguagePack | null;
  list: () => LanguagePack[];
}

export const createLanguagePackRegistry = (): LanguagePackRegistry => {
  const packs = new Map<string, LanguagePack>();

  return {
    register: (pack) => {
      packs.set(pack.locale, pack);
    },
    unregister: (locale) => {
      packs.delete(locale);
    },
    get: (locale) => packs.get(locale) ?? null,
    list: () => Array.from(packs.values()).sort((left, right) => left.locale.localeCompare(right.locale))
  };
};

export const rendererLanguagePackRegistry = createLanguagePackRegistry();
rendererLanguagePackRegistry.register(chineseLanguagePack);
rendererLanguagePackRegistry.register(englishLanguagePack);
