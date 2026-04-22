import { useSyncExternalStore } from 'react';
import type { ShortcutConfig } from './shortcuts-config';

const MAX_UNDO_STEPS_STORAGE_KEY = 'openweave:settings:maxUndoSteps';
const THEME_STORAGE_KEY = 'openweave:settings:theme';
const SHORTCUTS_STORAGE_KEY = 'openweave:settings:shortcuts';
const DEFAULT_MAX_UNDO_STEPS = 50;
const MIN_UNDO_STEPS = 10;
const MAX_UNDO_STEPS = 200;

type ThemeSetting = 'light' | 'dark' | 'system';

interface SettingsState {
  maxUndoSteps: number;
  theme: ThemeSetting;
  shortcuts: Record<string, ShortcutConfig>;
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

const isValidShortcutConfig = (value: unknown): value is ShortcutConfig => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.key === 'string' &&
    typeof candidate.ctrlKey === 'boolean' &&
    typeof candidate.metaKey === 'boolean' &&
    typeof candidate.shiftKey === 'boolean' &&
    typeof candidate.altKey === 'boolean'
  );
};

const loadShortcuts = (): Record<string, ShortcutConfig> => {
  try {
    const stored = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
    if (stored !== null) {
      const parsed = JSON.parse(stored) as unknown;
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        const result: Record<string, ShortcutConfig> = {};
        for (const [id, config] of Object.entries(parsed)) {
          if (isValidShortcutConfig(config)) {
            result[id] = config;
          }
        }
        return result;
      }
    }
  } catch {
    // ignore
  }
  return {};
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

  const shortcuts = loadShortcuts();
  return { maxUndoSteps, theme, shortcuts };
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

  if (previous.shortcuts !== state.shortcuts) {
    try {
      localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(state.shortcuts));
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
  getShortcutOverride: (id: string): ShortcutConfig | undefined => {
    return state.shortcuts[id];
  },
  setShortcut: (id: string, config: ShortcutConfig): void => {
    setState({
      shortcuts: { ...state.shortcuts, [id]: config }
    });
  },
  resetShortcut: (id: string): void => {
    const { [id]: _, ...next } = state.shortcuts;
    setState({ shortcuts: next });
  },
  resetAllShortcuts: (): void => {
    setState({ shortcuts: {} });
  }
};

export const useSettingsStore = <T,>(selector: (storeState: SettingsState) => T): T => {
  return useSyncExternalStore(
    settingsStore.subscribe,
    () => selector(settingsStore.getState()),
    () => selector(loadState())
  );
};
