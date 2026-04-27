import { useSyncExternalStore } from 'react';

const MAX_UNDO_STEPS_STORAGE_KEY = 'openweave:settings:maxUndoSteps';
const THEME_STORAGE_KEY = 'openweave:settings:theme';
const DEFAULT_MAX_UNDO_STEPS = 50;
const MIN_UNDO_STEPS = 10;
const MAX_UNDO_STEPS = 200;

const SHORTCUTS_STORAGE_KEY = 'openweave:settings:shortcuts';

export interface ShortcutBinding {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export type ShortcutActionId =
  | 'open-command-palette'
  | 'open-quick-add'
  | 'toggle-inspector'
  | 'add-terminal'
  | 'add-note'
  | 'add-portal'
  | 'add-file-tree'
  | 'add-text'
  | 'escape'
  | 'delete-selected'
  | 'undo'
  | 'redo'
  | 'toggle-connect-mode';

export interface ShortcutActionMeta {
  actionId: ShortcutActionId;
  labelKey: string;
}

export const SHORTCUT_ACTIONS: ShortcutActionMeta[] = [
  { actionId: 'open-command-palette', labelKey: 'shortcuts.commandPalette' },
  { actionId: 'open-quick-add', labelKey: 'shortcuts.quickAdd' },
  { actionId: 'toggle-inspector', labelKey: 'shortcuts.toggleInspector' },
  { actionId: 'add-terminal', labelKey: 'shortcuts.addTerminal' },
  { actionId: 'add-note', labelKey: 'shortcuts.addNote' },
  { actionId: 'add-portal', labelKey: 'shortcuts.addPortal' },
  { actionId: 'add-file-tree', labelKey: 'shortcuts.addFileTree' },
  { actionId: 'add-text', labelKey: 'shortcuts.addText' },
  { actionId: 'escape', labelKey: 'shortcuts.escape' },
  { actionId: 'delete-selected', labelKey: 'shortcuts.deleteSelected' },
  { actionId: 'undo', labelKey: 'shortcuts.undo' },
  { actionId: 'redo', labelKey: 'shortcuts.redo' },
  { actionId: 'toggle-connect-mode', labelKey: 'shortcuts.toggleConnectMode' }
];

const DEFAULT_SHORTCUT_BINDINGS: Record<ShortcutActionId, ShortcutBinding> = {
  'open-command-palette': { key: 'k', ctrlKey: true, metaKey: true, shiftKey: false, altKey: false },
  'open-quick-add': { key: '/', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
  'toggle-inspector': { key: 'i', ctrlKey: false, metaKey: true, shiftKey: true, altKey: false },
  'add-terminal': { key: '1', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
  'add-note': { key: '2', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
  'add-portal': { key: '3', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
  'add-file-tree': { key: '4', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
  'add-text': { key: '5', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
  'escape': { key: 'Escape', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
  'delete-selected': { key: 'Delete', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
  'undo': { key: 'z', ctrlKey: true, metaKey: true, shiftKey: false, altKey: false },
  'redo': { key: 'z', ctrlKey: false, metaKey: true, shiftKey: true, altKey: false },
  'toggle-connect-mode': { key: 'c', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }
};

type ThemeSetting = 'light' | 'dark' | 'system';

interface SettingsState {
  maxUndoSteps: number;
  theme: ThemeSetting;
  shortcutBindings: Record<ShortcutActionId, ShortcutBinding>;
}

type SettingsListener = () => void;

const clampUndoSteps = (value: number): number => {
  if (!Number.isFinite(value) || value < MIN_UNDO_STEPS) return MIN_UNDO_STEPS;
  if (value > MAX_UNDO_STEPS) return MAX_UNDO_STEPS;
  return Math.floor(value);
};

const parseTheme = (value: string | null): ThemeSetting => {
  if (value === 'light' || value === 'dark' || value === 'system') return value;
  return 'system';
};

const loadState = (): SettingsState => {
  let maxUndoSteps = DEFAULT_MAX_UNDO_STEPS;
  try {
    const stored = localStorage.getItem(MAX_UNDO_STEPS_STORAGE_KEY);
    if (stored !== null) {
      maxUndoSteps = clampUndoSteps(Number(stored));
    }
  } catch {
    // ignore localStorage errors
  }

  let theme: ThemeSetting = 'system';
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    theme = parseTheme(stored);
  } catch {
    // ignore localStorage errors
  }

  let shortcutBindings: Record<ShortcutActionId, ShortcutBinding> = { ...DEFAULT_SHORTCUT_BINDINGS };
  try {
    const stored = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
    if (stored !== null) {
      const parsed = JSON.parse(stored) as Partial<Record<ShortcutActionId, ShortcutBinding>>;
      shortcutBindings = { ...DEFAULT_SHORTCUT_BINDINGS, ...parsed };
    }
  } catch {
    // ignore localStorage errors
  }

  return { maxUndoSteps, theme, shortcutBindings };
};

let state: SettingsState = loadState();
const listeners = new Set<SettingsListener>();

const setState = (nextState: Partial<SettingsState>): void => {
  const previous = state;
  state = { ...state, ...nextState };

  if (previous.maxUndoSteps !== state.maxUndoSteps) {
    try {
      localStorage.setItem(MAX_UNDO_STEPS_STORAGE_KEY, String(state.maxUndoSteps));
    } catch {
      // ignore
    }
  }

  if (previous.theme !== state.theme) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, state.theme);
    } catch {
      // ignore
    }
  }

  if (previous.shortcutBindings !== state.shortcutBindings) {
    try {
      localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(state.shortcutBindings));
    } catch {
      // ignore
    }
  }

  for (const listener of listeners) {
    listener();
  }
};

export const settingsStore = {
  getState: (): SettingsState => state,
  subscribe: (listener: SettingsListener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  setMaxUndoSteps: (value: number): void => {
    setState({ maxUndoSteps: clampUndoSteps(value) });
  },
  setTheme: (theme: ThemeSetting): void => {
    setState({ theme });
  },
  updateShortcutBinding: (actionId: ShortcutActionId, binding: ShortcutBinding): void => {
    setState({
      shortcutBindings: {
        ...state.shortcutBindings,
        [actionId]: binding
      }
    });
  },
  resetShortcutBindings: (): void => {
    setState({ shortcutBindings: { ...DEFAULT_SHORTCUT_BINDINGS } });
  }
};

export const useSettingsStore = <T,>(selector: (storeState: SettingsState) => T): T => {
  return useSyncExternalStore(
    settingsStore.subscribe,
    () => selector(settingsStore.getState()),
    () => selector(loadState())
  );
};
