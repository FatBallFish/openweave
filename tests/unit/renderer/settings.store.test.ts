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
});
