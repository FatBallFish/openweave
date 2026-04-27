import { settingsStore, useSettingsStore, SHORTCUT_ACTIONS, type ShortcutActionId, type ShortcutBinding } from './settings.store';
import { useI18n } from '../../i18n/provider';

const modifierLabels: { key: keyof Omit<ShortcutBinding, 'key'>; label: string }[] = [
  { key: 'ctrlKey', label: 'Ctrl' },
  { key: 'metaKey', label: 'Cmd' },
  { key: 'shiftKey', label: 'Shift' },
  { key: 'altKey', label: 'Alt' }
];

export const ShortcutsTab = (): JSX.Element => {
  const { t } = useI18n();
  const bindings = useSettingsStore((s) => s.shortcutBindings);

  const updateBinding = (actionId: ShortcutActionId, patch: Partial<ShortcutBinding>) => {
    const current = bindings[actionId];
    settingsStore.updateShortcutBinding(actionId, { ...current, ...patch });
  };

  const handleKeyDown = (actionId: ShortcutActionId) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const key = e.key;
    if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return;
    if (key === 'Tab') return;
    const binding: ShortcutBinding = {
      key: key.length === 1 ? key.toLowerCase() : key,
      ctrlKey: e.ctrlKey || e.metaKey,
      metaKey: false,
      shiftKey: e.shiftKey,
      altKey: e.altKey
    };
    settingsStore.updateShortcutBinding(actionId, binding);
  };

  return (
    <div className="ow-shortcuts-tab">
      <div className="ow-settings-dialog__group">
        <h3>Keyboard Shortcuts</h3>
        <p className="ow-settings-dialog__hint">Click a key field and press the desired key combination. Click modifiers to toggle.</p>
      </div>

      {SHORTCUT_ACTIONS.map((action) => {
        const binding = bindings[action.actionId];
        return (
          <div key={action.actionId} className="ow-shortcuts-tab__row">
            <span className="ow-shortcuts-tab__label">{t(action.labelKey)}</span>
            <div className="ow-shortcuts-tab__controls">
              {modifierLabels.map((mod) => (
                <button
                  key={mod.key}
                  aria-pressed={binding[mod.key] as boolean}
                  className={`ow-shortcuts-tab__modifier${binding[mod.key] ? ' is-active' : ''}`}
                  onClick={() => updateBinding(action.actionId, { [mod.key]: !binding[mod.key] })}
                  type="button"
                >
                  {mod.label}
                </button>
              ))}
              <input
                className="ow-shortcuts-tab__key-input"
                defaultValue={binding.key}
                onKeyDown={handleKeyDown(action.actionId)}
                readOnly
              />
            </div>
          </div>
        );
      })}

      <div className="ow-settings-dialog__group" style={{ marginTop: 20 }}>
        <button
          className="ow-toolbar-button"
          type="button"
          onClick={() => settingsStore.resetShortcutBindings()}
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
};
