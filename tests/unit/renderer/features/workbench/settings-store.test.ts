import { describe, expect, it, beforeEach } from 'vitest';
import { settingsStore } from '../../../../../src/renderer/features/workbench/settings.store';

describe('settingsStore shortcuts', () => {
  beforeEach(() => {
    settingsStore.resetAllShortcuts();
  });

  it('returns undefined override for unknown id', () => {
    expect(settingsStore.getShortcutOverride('unknown')).toBeUndefined();
  });

  it('sets and retrieves a shortcut override', () => {
    const config = { key: 'p', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false };
    settingsStore.setShortcut('open-command-palette', config);
    expect(settingsStore.getShortcutOverride('open-command-palette')).toEqual(config);
  });

  it('resets a single shortcut', () => {
    settingsStore.setShortcut('open-command-palette', { key: 'p', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false });
    settingsStore.resetShortcut('open-command-palette');
    expect(settingsStore.getShortcutOverride('open-command-palette')).toBeUndefined();
  });

  it('resets all shortcuts', () => {
    settingsStore.setShortcut('open-command-palette', { key: 'p', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false });
    settingsStore.setShortcut('undo', { key: 'u', metaKey: true, ctrlKey: false, shiftKey: false, altKey: false });
    settingsStore.resetAllShortcuts();
    expect(settingsStore.getShortcutOverride('open-command-palette')).toBeUndefined();
    expect(settingsStore.getShortcutOverride('undo')).toBeUndefined();
  });
});
