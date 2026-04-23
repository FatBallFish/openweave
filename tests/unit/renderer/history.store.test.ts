// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GraphNodeRecord } from '../../../src/shared/ipc/contracts';

const createNode = (id: string): GraphNodeRecord => ({
  id,
  componentType: 'builtin.note',
  componentVersion: '1.0.0',
  title: 'Note',
  bounds: { x: 0, y: 0, width: 100, height: 100 },
  config: {},
  state: {},
  capabilities: []
});

const stubMaxUndoSteps = (maxUndoSteps: number): void => {
  vi.resetModules();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => {
      if (key === 'openweave:settings:maxUndoSteps') return String(maxUndoSteps);
      return null;
    },
    setItem: vi.fn(),
    clear: vi.fn()
  });
};

describe('history store', () => {
  beforeEach(() => {
    stubMaxUndoSteps(50);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts empty with no undo/redo', async () => {
    const { historyStore } = await import('../../../src/renderer/features/canvas/history.store');
    expect(historyStore.getState().canUndo).toBe(false);
    expect(historyStore.getState().canRedo).toBe(false);
    expect(historyStore.getState().stack).toHaveLength(0);
  });

  it('pushes entries and allows undo/redo', async () => {
    const { historyStore } = await import('../../../src/renderer/features/canvas/history.store');
    const node = createNode('node-1');

    historyStore.push({ kind: 'addNode', node });
    expect(historyStore.getState().canUndo).toBe(true);
    expect(historyStore.getState().canRedo).toBe(false);
    expect(historyStore.getState().stack).toHaveLength(1);

    const undone = historyStore.undo();
    expect(undone).toEqual({ kind: 'addNode', node });
    expect(historyStore.getState().canUndo).toBe(false);
    expect(historyStore.getState().canRedo).toBe(true);

    const redone = historyStore.redo();
    expect(redone).toEqual({ kind: 'addNode', node });
    expect(historyStore.getState().canUndo).toBe(true);
    expect(historyStore.getState().canRedo).toBe(false);
  });

  it('truncates forward history on new push after undo', async () => {
    const { historyStore } = await import('../../../src/renderer/features/canvas/history.store');
    const node1 = createNode('node-1');
    const node2 = createNode('node-2');
    const node3 = createNode('node-3');

    historyStore.push({ kind: 'addNode', node: node1 });
    historyStore.push({ kind: 'addNode', node: node2 });
    historyStore.undo();
    historyStore.push({ kind: 'addNode', node: node3 });

    expect(historyStore.getState().stack).toHaveLength(2);
    expect(historyStore.getState().canRedo).toBe(false);
  });

  it('respects max undo steps and drops oldest entries', async () => {
    stubMaxUndoSteps(10);
    const { historyStore } = await import('../../../src/renderer/features/canvas/history.store');

    for (let i = 1; i <= 11; i += 1) {
      historyStore.push({ kind: 'addNode', node: createNode(`node-${i}`) });
    }

    expect(historyStore.getState().stack).toHaveLength(10);
    expect(historyStore.getState().stack[0].node.id).toBe('node-2');
  });

  it('clears all history', async () => {
    const { historyStore } = await import('../../../src/renderer/features/canvas/history.store');
    historyStore.push({ kind: 'addNode', node: createNode('node-1') });
    historyStore.clear();
    expect(historyStore.getState().stack).toHaveLength(0);
    expect(historyStore.getState().canUndo).toBe(false);
  });

  it('returns null when undoing on an empty stack', async () => {
    const { historyStore } = await import('../../../src/renderer/features/canvas/history.store');
    const result = historyStore.undo();
    expect(result).toBeNull();
  });

  it('returns null when redoing on an empty stack', async () => {
    const { historyStore } = await import('../../../src/renderer/features/canvas/history.store');
    const result = historyStore.redo();
    expect(result).toBeNull();
  });

  it('supports multiple undos and redos in sequence', async () => {
    const { historyStore } = await import('../../../src/renderer/features/canvas/history.store');
    const node1 = createNode('node-1');
    const node2 = createNode('node-2');
    const node3 = createNode('node-3');

    historyStore.push({ kind: 'addNode', node: node1 });
    historyStore.push({ kind: 'addNode', node: node2 });
    historyStore.push({ kind: 'addNode', node: node3 });

    expect(historyStore.getState().stack).toHaveLength(3);
    expect(historyStore.getState().index).toBe(2);

    const undone1 = historyStore.undo();
    expect(undone1).toEqual({ kind: 'addNode', node: node3 });
    expect(historyStore.getState().index).toBe(1);

    const undone2 = historyStore.undo();
    expect(undone2).toEqual({ kind: 'addNode', node: node2 });
    expect(historyStore.getState().index).toBe(0);

    const redone1 = historyStore.redo();
    expect(redone1).toEqual({ kind: 'addNode', node: node2 });
    expect(historyStore.getState().index).toBe(1);

    const redone2 = historyStore.redo();
    expect(redone2).toEqual({ kind: 'addNode', node: node3 });
    expect(historyStore.getState().index).toBe(2);

    expect(historyStore.getState().canUndo).toBe(true);
    expect(historyStore.getState().canRedo).toBe(false);
  });

  it('adjusts max size and drops oldest entries', async () => {
    // MIN_UNDO_STEPS in settings.store.ts is 10, so use values above that
    stubMaxUndoSteps(15);
    const { historyStore } = await import('../../../src/renderer/features/canvas/history.store');
    const { settingsStore } = await import('../../../src/renderer/features/workbench/settings.store');

    for (let i = 1; i <= 15; i += 1) {
      historyStore.push({ kind: 'addNode', node: createNode(`node-${i}`) });
    }

    expect(historyStore.getState().stack).toHaveLength(15);
    expect(historyStore.getState().stack[0].node.id).toBe('node-1');
    expect(historyStore.getState().index).toBe(14);

    // Reduce max undo steps and trigger adjustment
    settingsStore.setMaxUndoSteps(10);
    historyStore.adjustMaxSize();

    expect(historyStore.getState().stack).toHaveLength(10);
    expect(historyStore.getState().stack[0].node.id).toBe('node-6');
    expect(historyStore.getState().index).toBe(9);
  });
});
