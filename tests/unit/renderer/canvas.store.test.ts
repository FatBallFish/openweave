import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setBridge = (bridge: Record<string, unknown>): void => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      openweaveShell: {
        canvas: bridge
      }
    }
  });
};

const setRandomUuid = (): void => {
  let counter = 0;
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      randomUUID: () => {
        counter += 1;
        return `uuid-${counter}`;
      }
    }
  });
};

const importStore = async () => {
  vi.resetModules();
  return import('../../../src/renderer/features/canvas/canvas.store');
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('canvas store', () => {
  beforeEach(() => {
    setRandomUuid();
    setBridge({
      loadCanvasState: vi.fn().mockResolvedValue({ state: { nodes: [], edges: [] } }),
      saveCanvasState: vi.fn().mockImplementation(async (input: { state: { nodes: unknown[]; edges: unknown[] } }) => ({
        state: input.state
      }))
    });
  });

  it('loads the canvas state and handles load errors', async () => {
    const loadCanvasState = vi
      .fn()
      .mockResolvedValueOnce({ state: { nodes: [{ id: 'note-1', type: 'note', x: 1, y: 2, contentMd: '' }], edges: [] } })
      .mockRejectedValueOnce(new Error('load failed'));
    setBridge({
      loadCanvasState,
      saveCanvasState: vi.fn()
    });

    const { canvasStore } = await importStore();
    await canvasStore.loadCanvasState('ws-1');
    expect(canvasStore.getState().nodes).toHaveLength(1);

    await canvasStore.loadCanvasState('ws-2');
    expect(canvasStore.getState().errorMessage).toBe('load failed');
  });

  it('adds and updates note, terminal, file-tree, and portal nodes', async () => {
    const saveCanvasState = vi.fn().mockImplementation(async (input: { state: { nodes: unknown[]; edges: unknown[] } }) => ({
      state: input.state
    }));
    setBridge({
      loadCanvasState: vi.fn().mockResolvedValue({ state: { nodes: [], edges: [] } }),
      saveCanvasState
    });

    const { canvasStore } = await importStore();
    await canvasStore.loadCanvasState('ws-1');

    await canvasStore.addNoteNode();
    await canvasStore.addTerminalNode();
    await canvasStore.addFileTreeNode('/tmp/workspace');
    await canvasStore.addPortalNode();
    expect(canvasStore.getState().nodes).toHaveLength(4);

    const noteId = canvasStore.getState().nodes.find((node) => node.type === 'note')?.id ?? '';
    const terminalId =
      canvasStore.getState().nodes.find((node) => node.type === 'terminal')?.id ?? '';
    const fileTreeId =
      canvasStore.getState().nodes.find((node) => node.type === 'file-tree')?.id ?? '';
    const portalId = canvasStore.getState().nodes.find((node) => node.type === 'portal')?.id ?? '';

    await canvasStore.updateNoteNode(noteId, { contentMd: 'updated' });
    await canvasStore.updateTerminalNode(terminalId, { command: 'pwd' });
    await canvasStore.updateFileTreeNode(fileTreeId, { x: 500 });
    await canvasStore.updatePortalNode(portalId, { url: 'https://example.com/demo' });

    expect(saveCanvasState).toHaveBeenCalled();
    expect(canvasStore.getState().nodes.find((node) => node.id === noteId)).toMatchObject({
      contentMd: 'updated'
    });
    expect(canvasStore.getState().nodes.find((node) => node.id === terminalId)).toMatchObject({
      command: 'pwd'
    });
  });

  it('stores save failures and ignores mutations when no workspace is active', async () => {
    const saveCanvasState = vi.fn().mockRejectedValue(new Error('save failed'));
    setBridge({
      loadCanvasState: vi.fn().mockResolvedValue({ state: { nodes: [], edges: [] } }),
      saveCanvasState
    });

    const { canvasStore } = await importStore();
    await canvasStore.addNoteNode();
    expect(canvasStore.getState().nodes).toEqual([]);

    await canvasStore.loadCanvasState('ws-1');
    await canvasStore.addNoteNode();
    expect(canvasStore.getState().errorMessage).toBe('save failed');
  });
});
