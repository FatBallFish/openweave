import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  I18nProvider,
  resolveInitialLocale,
  useI18n
} from '../../../src/renderer/i18n/provider';
import { createLanguagePackRegistry } from '../../../src/renderer/i18n/registry';
import { englishLanguagePack } from '../../../src/renderer/i18n/packs/en-US';
import { chineseLanguagePack } from '../../../src/renderer/i18n/packs/zh-CN';

const Probe = (): JSX.Element => {
  const { locale, t } = useI18n();

  return createElement(
    'div',
    {
      'data-locale': locale,
      'data-title': t('app.title'),
      'data-terminal': t('topbar.addTerminal')
    },
    t('app.title')
  );
};

describe('renderer i18n', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists bundled Chinese and English language packs and supports uninstall', () => {
    const registry = createLanguagePackRegistry();

    registry.register(chineseLanguagePack);
    registry.register(englishLanguagePack);

    expect(registry.list().map((pack) => pack.locale)).toEqual(['en-US', 'zh-CN']);
    expect(registry.get('zh-CN')?.messages['app.title']).toBe('OpenWeave');

    registry.unregister('en-US');
    expect(registry.get('en-US')).toBeNull();
  });

  it('provides translated strings and falls back to the default locale', () => {
    const registry = createLanguagePackRegistry();
    registry.register(chineseLanguagePack);
    registry.register(englishLanguagePack);

    const englishHtml = renderToStaticMarkup(
      createElement(I18nProvider, { locale: 'en-US', registry }, createElement(Probe))
    );
    const fallbackHtml = renderToStaticMarkup(
      createElement(I18nProvider, { locale: 'fr-FR', registry }, createElement(Probe))
    );

    expect(englishHtml).toContain('data-locale="en-US"');
    expect(englishHtml).toContain('data-terminal="Add terminal"');
    expect(fallbackHtml).toContain('data-locale="zh-CN"');
    expect(fallbackHtml).toContain('data-terminal="添加终端"');
  });

  it('prefers a stored locale when it is installed', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => 'en-US'
      }
    });

    const registry = createLanguagePackRegistry();
    registry.register(chineseLanguagePack);
    registry.register(englishLanguagePack);

    expect(resolveInitialLocale({ registry })).toBe('en-US');
    expect(resolveInitialLocale({ locale: 'zh-CN', registry })).toBe('zh-CN');
  });
});
