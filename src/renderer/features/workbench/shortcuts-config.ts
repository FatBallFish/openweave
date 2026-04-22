export interface ShortcutConfig {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

export interface ShortcutDefinition {
  readonly id: string;
  readonly labelKey: string;
  readonly defaultConfig: ShortcutConfig;
  readonly aliases?: readonly ShortcutConfig[];
  readonly group: 'canvas' | 'general' | 'edit';
}

export const SHORTCUT_DEFINITIONS: readonly ShortcutDefinition[] = [
  {
    id: 'open-command-palette',
    labelKey: 'settings.shortcuts.openCommandPalette',
    defaultConfig: { key: 'k', ctrlKey: false, metaKey: true, shiftKey: false, altKey: false },
    group: 'general'
  },
  {
    id: 'open-quick-add',
    labelKey: 'settings.shortcuts.openQuickAdd',
    defaultConfig: { key: '/', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
    group: 'general'
  },
  {
    id: 'toggle-inspector',
    labelKey: 'settings.shortcuts.toggleInspector',
    defaultConfig: { key: 'i', ctrlKey: false, metaKey: true, shiftKey: true, altKey: false },
    group: 'general'
  },
  {
    id: 'escape',
    labelKey: 'settings.shortcuts.escape',
    defaultConfig: { key: 'escape', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
    group: 'general'
  },
  {
    id: 'add-terminal',
    labelKey: 'settings.shortcuts.addTerminal',
    defaultConfig: { key: '1', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
    group: 'canvas'
  },
  {
    id: 'add-note',
    labelKey: 'settings.shortcuts.addNote',
    defaultConfig: { key: '2', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
    group: 'canvas'
  },
  {
    id: 'add-portal',
    labelKey: 'settings.shortcuts.addPortal',
    defaultConfig: { key: '3', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
    group: 'canvas'
  },
  {
    id: 'add-file-tree',
    labelKey: 'settings.shortcuts.addFileTree',
    defaultConfig: { key: '4', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
    group: 'canvas'
  },
  {
    id: 'add-text',
    labelKey: 'settings.shortcuts.addText',
    defaultConfig: { key: '5', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
    group: 'canvas'
  },
  {
    id: 'delete-selected',
    labelKey: 'settings.shortcuts.deleteSelected',
    defaultConfig: { key: 'backspace', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
    aliases: [{ key: 'delete', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }],
    group: 'edit'
  },
  {
    id: 'undo',
    labelKey: 'settings.shortcuts.undo',
    defaultConfig: { key: 'z', ctrlKey: false, metaKey: true, shiftKey: false, altKey: false },
    group: 'edit'
  },
  {
    id: 'redo',
    labelKey: 'settings.shortcuts.redo',
    defaultConfig: { key: 'z', ctrlKey: false, metaKey: true, shiftKey: true, altKey: false },
    aliases: [{ key: 'y', ctrlKey: false, metaKey: true, shiftKey: false, altKey: false }],
    group: 'edit'
  }
];

export const isMac = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

export const formatShortcut = (config: ShortcutConfig): string => {
  const mac = isMac();
  const parts: string[] = [];

  if (mac) {
    if (config.ctrlKey) parts.push('⌃');
    if (config.altKey) parts.push('⌥');
    if (config.shiftKey) parts.push('⇧');
    if (config.metaKey) parts.push('⌘');
  } else {
    if (config.ctrlKey) parts.push('Ctrl');
    if (config.altKey) parts.push('Alt');
    if (config.shiftKey) parts.push('Shift');
    if (config.metaKey) parts.push('Win');
  }

  const keyDisplay = config.key.length === 1 ? config.key.toUpperCase() : config.key;
  parts.push(keyDisplay);

  return mac ? parts.join('') : parts.join('+');
};

export const configsEqual = (a: ShortcutConfig, b: ShortcutConfig): boolean =>
  a.key.toLowerCase() === b.key.toLowerCase() &&
  a.ctrlKey === b.ctrlKey &&
  a.metaKey === b.metaKey &&
  a.shiftKey === b.shiftKey &&
  a.altKey === b.altKey;

export const getMergedConfig = (
  id: string,
  overrides: Record<string, ShortcutConfig>
): ShortcutConfig => {
  const def = SHORTCUT_DEFINITIONS.find((d) => d.id === id);
  return overrides[id] ?? (def?.defaultConfig ? { ...def.defaultConfig } : { key: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false });
};
