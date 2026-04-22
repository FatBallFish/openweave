import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n/provider';
import { settingsStore, useSettingsStore } from './settings.store';
import {
  formatShortcut,
  getMergedConfig,
  SHORTCUT_DEFINITIONS,
  type ShortcutConfig
} from './shortcuts-config';

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

const ShortcutsSettingsPanel = (): JSX.Element => {
  const { t } = useI18n();
  const shortcuts = useSettingsStore((s) => s.shortcuts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const listeningRef = useRef(false);

  const conflictMap = useCallback((): Map<string, string[]> => {
    const conflicts = new Map<string, string[]>();
    const configs = SHORTCUT_DEFINITIONS.map((def) => ({
      id: def.id,
      config: getMergedConfig(def.id, shortcuts)
    }));

    for (let i = 0; i < configs.length; i++) {
      for (let j = i + 1; j < configs.length; j++) {
        if (
          configs[i].config.key.toLowerCase() === configs[j].config.key.toLowerCase() &&
          configs[i].config.ctrlKey === configs[j].config.ctrlKey &&
          configs[i].config.metaKey === configs[j].config.metaKey &&
          configs[i].config.shiftKey === configs[j].config.shiftKey &&
          configs[i].config.altKey === configs[j].config.altKey
        ) {
          const a = conflicts.get(configs[i].id) ?? [];
          a.push(configs[j].id);
          conflicts.set(configs[i].id, a);

          const b = conflicts.get(configs[j].id) ?? [];
          b.push(configs[i].id);
          conflicts.set(configs[j].id, b);
        }
      }
    }

    return conflicts;
  }, [shortcuts]);

  const conflicts = conflictMap();

  useEffect(() => {
    if (!editingId) {
      listeningRef.current = false;
      return;
    }

    listeningRef.current = true;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!listeningRef.current) return;

      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setEditingId(null);
        return;
      }

      const isModifierOnly = ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key);
      if (isModifierOnly) return;

      const config: ShortcutConfig = {
        key: e.key.toLowerCase() === 'escape' ? 'escape' : e.key,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey
      };

      settingsStore.setShortcut(editingId, config);
      setEditingId(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      listeningRef.current = false;
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [editingId]);

  const grouped = {
    canvas: SHORTCUT_DEFINITIONS.filter((d) => d.group === 'canvas'),
    general: SHORTCUT_DEFINITIONS.filter((d) => d.group === 'general'),
    edit: SHORTCUT_DEFINITIONS.filter((d) => d.group === 'edit')
  };

  const groupLabels: Record<string, string> = {
    canvas: t('settings.shortcuts.groupCanvas'),
    general: t('settings.shortcuts.groupGeneral'),
    edit: t('settings.shortcuts.groupEdit')
  };

  return (
    <div className="ow-settings-dialog__groups">
      {(['general', 'canvas', 'edit'] as const).map((group) => (
        <section key={group} className="ow-settings-dialog__group">
          <h3>{groupLabels[group]}</h3>
          <div className="ow-settings-dialog__shortcuts-list">
            {grouped[group].map((def) => {
              const config = getMergedConfig(def.id, shortcuts);
              const isEditing = editingId === def.id;
              const conflictIds = conflicts.get(def.id) ?? [];
              const hasConflict = conflictIds.length > 0;

              return (
                <div
                  key={def.id}
                  className={`ow-settings-dialog__shortcut-row${hasConflict ? ' is-conflict' : ''}`}
                  data-testid={`shortcut-row-${def.id}`}
                >
                  <span className="ow-settings-dialog__shortcut-name">
                    {t(def.labelKey)}
                  </span>
                  <div className="ow-settings-dialog__shortcut-right">
                    <button
                      className={`ow-settings-dialog__shortcut-key${isEditing ? ' is-listening' : ''}`}
                      onClick={() => setEditingId(def.id)}
                      type="button"
                      data-testid={`shortcut-key-${def.id}`}
                    >
                      {isEditing ? t('settings.shortcuts.listening') : formatShortcut(config)}
                    </button>
                    {hasConflict && (
                      <span className="ow-settings-dialog__shortcut-conflict">
                        {t('settings.shortcuts.conflict')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="ow-settings-dialog__shortcuts-footer">
        <button
          className="ow-settings-dialog__shortcuts-reset"
          onClick={() => {
            if (window.confirm(t('settings.shortcuts.resetConfirm'))) {
              settingsStore.resetAllShortcuts();
            }
          }}
          type="button"
          data-testid="shortcuts-reset-all"
        >
          {t('settings.shortcuts.resetAll')}
        </button>
      </div>
    </div>
  );
};

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
            {activeTab === 'role' && <div className="ow-settings-dialog__placeholder" />}
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
                      type="number"
                      value={maxUndoSteps}
                    />
                  </div>
                </section>
              </div>
            )}
            {activeTab === 'shortcuts' && <ShortcutsSettingsPanel />}
            {activeTab === 'data' && <div className="ow-settings-dialog__placeholder" />}
            {activeTab === 'about' && <div className="ow-settings-dialog__placeholder" />}
          </div>
        </div>
      </section>
    </div>
  );

  return createPortal(content, document.body);
};
