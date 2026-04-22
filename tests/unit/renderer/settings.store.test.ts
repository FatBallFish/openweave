import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createMockStorage = (): Storage => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string): string | null => store[key] ?? null,
    setItem: (key: string, value: string): void => {
      store[key] = value;
    },
    removeItem: (key: string): void => {
      delete store[key];
    },
    clear: (): void => {
      store = {};
    },
    key: (index: number): string | null => Object.keys(store)[index] ?? null,
    get length(): number {
      return Object.keys(store).length;
    }
  };
};

const createMockStorageWithThrowingGet = (): Storage => {
  const storage = createMockStorage();
  return {
    ...storage,
    getItem: () => {
      throw new Error('localStorage read error');
    }
  };
};

const createMockStorageWithThrowingSet = (): Storage => {
  const storage = createMockStorage();
  return {
    ...storage,
    setItem: () => {
      throw new Error('localStorage write error');
    }
  };
};

describe('settings store', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    vi.stubGlobal('localStorage', mockStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes with defaults when localStorage is empty', async () => {
    vi.resetModules();
    const { settingsStore } = await import('../../../src/renderer/features/workbench/settings.store');
    expect(settingsStore.getState().maxUndoSteps).toBe(50);
    expect(settingsStore.getState().theme).toBe('system');
  });

  it('reads maxUndoSteps from localStorage', async () => {
    mockStorage.setItem('openweave:settings:maxUndoSteps', '30');
    vi.resetModules();
    const { settingsStore } = await import('../../../src/renderer/features/workbench/settings.store');
    expect(settingsStore.getState().maxUndoSteps).toBe(30);
  });

  it('clamps maxUndoSteps to valid range', async () => {
    vi.resetModules();
    const { settingsStore } = await import('../../../src/renderer/features/workbench/settings.store');
    settingsStore.setMaxUndoSteps(5);
    expect(settingsStore.getState().maxUndoSteps).toBe(10);
    settingsStore.setMaxUndoSteps(300);
    expect(settingsStore.getState().maxUndoSteps).toBe(200);
    settingsStore.setMaxUndoSteps(75);
    expect(settingsStore.getState().maxUndoSteps).toBe(75);
  });

  it('persists maxUndoSteps to localStorage', async () => {
    vi.resetModules();
    const { settingsStore } = await import('../../../src/renderer/features/workbench/settings.store');
    settingsStore.setMaxUndoSteps(80);
    expect(mockStorage.getItem('openweave:settings:maxUndoSteps')).toBe('80');
  });

  it('reads theme from localStorage', async () => {
    mockStorage.setItem('openweave:settings:theme', 'dark');
    vi.resetModules();
    const { settingsStore } = await import('../../../src/renderer/features/workbench/settings.store');
    expect(settingsStore.getState().theme).toBe('dark');
  });

  it('persists theme to localStorage', async () => {
    vi.resetModules();
    const { settingsStore } = await import('../../../src/renderer/features/workbench/settings.store');
    settingsStore.setTheme('light');
    expect(mockStorage.getItem('openweave:settings:theme')).toBe('light');
  });

  it('falls back to system theme for invalid stored values', async () => {
    mockStorage.setItem('openweave:settings:theme', 'invalid');
    vi.resetModules();
    const { settingsStore } = await import('../../../src/renderer/features/workbench/settings.store');
    expect(settingsStore.getState().theme).toBe('system');
  });

  it('falls back to defaults when localStorage.getItem throws', async () => {
    vi.stubGlobal('localStorage', createMockStorageWithThrowingGet());
    vi.resetModules();
    const { settingsStore } = await import('../../../src/renderer/features/workbench/settings.store');
    expect(settingsStore.getState().maxUndoSteps).toBe(50);
    expect(settingsStore.getState().theme).toBe('system');
  });

  it('updates in-memory state when localStorage.setItem throws', async () => {
    vi.stubGlobal('localStorage', createMockStorageWithThrowingSet());
    vi.resetModules();
    const { settingsStore } = await import('../../../src/renderer/features/workbench/settings.store');
    settingsStore.setMaxUndoSteps(80);
    expect(settingsStore.getState().maxUndoSteps).toBe(80);
    settingsStore.setTheme('light');
    expect(settingsStore.getState().theme).toBe('light');
  });

  it('floors floating-point maxUndoSteps from localStorage', async () => {
    mockStorage.setItem('openweave:settings:maxUndoSteps', '75.7');
    vi.resetModules();
    const { settingsStore } = await import('../../../src/renderer/features/workbench/settings.store');
    expect(settingsStore.getState().maxUndoSteps).toBe(75);
  });

  it('falls back to MIN_UNDO_STEPS for non-numeric maxUndoSteps from localStorage', async () => {
    mockStorage.setItem('openweave:settings:maxUndoSteps', 'abc');
    vi.resetModules();
    const { settingsStore } = await import('../../../src/renderer/features/workbench/settings.store');
    expect(settingsStore.getState().maxUndoSteps).toBe(10);
  });

  it('useSettingsStore is a valid function', async () => {
    vi.resetModules();
    const { useSettingsStore } = await import('../../../src/renderer/features/workbench/settings.store');
    expect(typeof useSettingsStore).toBe('function');
  });
});
