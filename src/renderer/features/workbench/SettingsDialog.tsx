import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n/provider';
import { settingsStore, useSettingsStore } from './settings.store';
import { RoleSettingsPanel } from './RoleSettingsPanel';
import { ShortcutsTab } from './ShortcutsTab';

type SettingsTab = 'general' | 'terminal' | 'role' | 'page' | 'shortcuts' | 'data' | 'about';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const TABS: { key: SettingsTab; labelKey: string }[] = [
  { key: 'general', labelKey: 'settings.tabGeneral' },
  { key: 'terminal', labelKey: 'settings.tabTerminal' },
  { key: 'role', labelKey: 'settings.tabRole' },
  { key: 'page', labelKey: 'settings.tabPage' },
  { key: 'shortcuts', labelKey: 'settings.tabShortcuts' },
  { key: 'data', labelKey: 'settings.tabData' },
  { key: 'about', labelKey: 'settings.tabAbout' }
];

export const SettingsDialog = ({ open, onClose }: SettingsDialogProps): JSX.Element | null => {
  const { t, locale, availableLocales, localeLabels, setLocale } = useI18n();
  const maxUndoSteps = useSettingsStore((s) => s.maxUndoSteps);
  const theme = useSettingsStore((s) => s.theme);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  const content = (
    <div className="ow-settings-dialog" role="dialog" aria-modal="true" data-testid="settings-dialog">
      <div className="ow-settings-dialog__backdrop" onClick={onClose} />
      <section className="ow-settings-dialog__surface">
        <header className="ow-settings-dialog__header">
          <h2>{t('settings.title')}</h2>
          <button
            aria-label={t('settings.close')}
            className="ow-settings-dialog__close"
            onClick={onClose}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
              <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
        </header>

        <div className="ow-settings-dialog__content">
          <nav className="ow-settings-dialog__tabs">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                aria-selected={activeTab === tab.key}
                className={`ow-settings-dialog__tab${activeTab === tab.key ? ' is-active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
                type="button"
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </nav>

          <div className="ow-settings-dialog__panel">
            {activeTab === 'general' && (
              <div className="ow-settings-dialog__groups">
                <section className="ow-settings-dialog__group">
                  <h3>{t('settings.groupLanguage')}</h3>
                  <div className="ow-settings-dialog__field">
                    <label>{t('settings.languageLabel')}</label>
                    <div className="ow-settings-dialog__language-options">
                      {availableLocales.map((availableLocale) => (
                        <button
                          key={availableLocale}
                          aria-pressed={availableLocale === locale}
                          className={`ow-settings-dialog__language-option${
                            availableLocale === locale ? ' is-active' : ''
                          }`}
                          onClick={() => setLocale(availableLocale)}
                          type="button"
                        >
                          {localeLabels[availableLocale] ?? availableLocale}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="ow-settings-dialog__group">
                  <h3>{t('settings.groupTheme')}</h3>
                  <div className="ow-settings-dialog__field">
                    <label>{t('settings.themeLabel')}</label>
                    <div className="ow-settings-dialog__language-options">
                      {(['light', 'dark', 'system'] as const).map((themeOption) => (
                        <button
                          key={themeOption}
                          aria-pressed={theme === themeOption}
                          className={`ow-settings-dialog__language-option${
                            theme === themeOption ? ' is-active' : ''
                          }`}
                          onClick={() => settingsStore.setTheme(themeOption)}
                          type="button"
                        >
                          {t(`settings.theme${themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            )}
            {activeTab === 'terminal' && <div className="ow-settings-dialog__placeholder" />}
            {activeTab === 'role' && <RoleSettingsPanel />}
            {activeTab === 'page' && (
              <div className="ow-settings-dialog__groups">
                <section className="ow-settings-dialog__group">
                  <h3>{t('settings.groupUndoRedo')}</h3>
                  <div className="ow-settings-dialog__field">
                    <label>{t('settings.maxUndoStepsLabel')}</label>
                    <input
                      className="ow-settings-dialog__number-input"
                      max={200}
                      min={10}
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10);
                        if (!Number.isNaN(value)) {
                          settingsStore.setMaxUndoSteps(value);
                        }
                      }}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
                          e.preventDefault();
                          e.currentTarget.select();
                        }
                      }}
                      type="number"
                      value={maxUndoSteps}
                    />
                  </div>
                </section>
              </div>
            )}
            {activeTab === 'shortcuts' && <ShortcutsTab />}
            {activeTab === 'data' && <div className="ow-settings-dialog__placeholder" />}
            {activeTab === 'about' && <div className="ow-settings-dialog__placeholder" />}
          </div>
        </div>
      </section>
    </div>
  );

  return createPortal(content, document.body);
};
