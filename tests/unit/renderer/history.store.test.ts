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

const setSettings = (maxUndoSteps: number): void => {
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
    setSettings(50);
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
    setSettings(10);
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
});
