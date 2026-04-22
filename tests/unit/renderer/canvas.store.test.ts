import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GraphSnapshotV2Input } from '../../../src/shared/ipc/schemas';

const setBridge = (bridge: Record<string, unknown>): void => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      openweaveShell: {
        graph: bridge
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

const createGraphSnapshot = (): GraphSnapshotV2Input => ({
  schemaVersion: 2,
  nodes: [
    {
      id: 'node-note-1',
      componentType: 'builtin.note',
      componentVersion: '1.0.0',
      title: 'Note',
      bounds: {
        x: 1,
        y: 2,
        width: 320,
        height: 240
      },
      config: {
        mode: 'markdown'
      },
      state: {
        content: 'hello'
      },
      capabilities: ['read', 'write'],
      createdAtMs: 1,
      updatedAtMs: 2
    },
    {
      id: 'node-terminal-1',
      componentType: 'builtin.terminal',
      componentVersion: '1.0.0',
      title: 'Terminal',
      bounds: {
        x: 20,
        y: 30,
        width: 420,
        height: 260
      },
      config: {
        command: 'pwd',
        runtime: 'shell'
      },
      state: {
        activeSessionId: null
      },
      capabilities: ['read', 'write', 'execute', 'stream'],
      createdAtMs: 3,
      updatedAtMs: 4
    }
  ],
  edges: []
});

const rectanglesOverlap = (
  left:
    | {
        x: number;
        y: number;
        width: number;
        height: number;
      }
    | undefined,
  right:
    | {
        x: number;
        y: number;
        width: number;
        height: number;
      }
    | undefined
): boolean => {
  if (!left || !right) {
    return false;
  }

  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('canvas store', () => {
  beforeEach(() => {
    setRandomUuid();
    setBridge({
      loadGraphSnapshot: vi.fn().mockResolvedValue({ graphSnapshot: createGraphSnapshot() }),
      saveGraphSnapshot: vi.fn().mockImplementation(async (input: { graphSnapshot: GraphSnapshotV2Input }) => ({
        graphSnapshot: input.graphSnapshot
      }))
    });
  });

  it('loads the graph snapshot through the graph bridge and handles load errors', async () => {
    const loadGraphSnapshot = vi
      .fn()
      .mockResolvedValueOnce({ graphSnapshot: createGraphSnapshot() })
      .mockRejectedValueOnce(new Error('load failed'));
    setBridge({
      loadGraphSnapshot,
      saveGraphSnapshot: vi.fn()
    });

    const { canvasStore } = await importStore();
    await canvasStore.loadCanvasState('ws-1');
    expect(canvasStore.getState().nodes).toHaveLength(2);
    expect(canvasStore.getState().graphSnapshot).toEqual(createGraphSnapshot());

    await canvasStore.loadCanvasState('ws-2');
    expect(canvasStore.getState().errorMessage).toBe('load failed');
  });

  it('adds and updates supported builtin nodes by saving graph snapshots with preserved metadata', async () => {
    const saveGraphSnapshot = vi.fn().mockImplementation(async (input: { graphSnapshot: GraphSnapshotV2Input }) => ({
      graphSnapshot: input.graphSnapshot
    }));
    setBridge({
      loadGraphSnapshot: vi.fn().mockResolvedValue({ graphSnapshot: createGraphSnapshot() }),
      saveGraphSnapshot
    });

    const { canvasStore } = await importStore();
    await canvasStore.loadCanvasState('ws-1');

    await canvasStore.addNoteNode();
    await canvasStore.addTerminalNode();
    await (canvasStore as unknown as { addTextNode: () => Promise<void> }).addTextNode();
    expect(canvasStore.getState().nodes).toHaveLength(4);
    expect(canvasStore.getState().graphSnapshot.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          componentType: 'builtin.text',
          title: 'Text'
        })
      ])
    );

    const noteId = canvasStore.getState().nodes.find((node) => node.type === 'note')?.id ?? '';
    const terminalId =
      canvasStore.getState().nodes.find((node) => node.type === 'terminal')?.id ?? '';
    expect(canvasStore.getState().nodes.find((node) => node.id === terminalId)).toMatchObject({
      command: 'pwd',
      runtime: 'shell'
    });

    await canvasStore.updateNoteNode(noteId, { contentMd: 'updated' });
    await (canvasStore as unknown as {
      updateTerminalNode: (
        nodeId: string,
        patch: { command?: string; runtime?: string }
      ) => Promise<void>;
    }).updateTerminalNode(terminalId, { command: 'pwd', runtime: 'codex' });

    expect(saveGraphSnapshot).toHaveBeenCalled();
    expect(saveGraphSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({
        graphSnapshot: expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({
              id: 'node-terminal-1',
              componentType: 'builtin.terminal',
              componentVersion: '1.0.0',
              bounds: expect.objectContaining({
                width: 420,
                height: 260
              }),
              config: expect.objectContaining({
                command: 'pwd',
                runtime: 'codex'
              }),
              state: expect.objectContaining({
                activeSessionId: null
              }),
              capabilities: ['read', 'write', 'execute', 'stream']
            })
          ])
        })
      })
    );
    expect(canvasStore.getState().nodes.find((node) => node.id === noteId)).toMatchObject({
      contentMd: 'updated'
    });
    expect(canvasStore.getState().nodes.find((node) => node.id === terminalId)).toMatchObject({
      command: 'pwd',
      runtime: 'codex'
    });
  });

  it('places newly added builtin hosts on a non-overlapping starter grid', async () => {
    const saveGraphSnapshot = vi.fn().mockImplementation(async (input: { graphSnapshot: GraphSnapshotV2Input }) => ({
      graphSnapshot: input.graphSnapshot
    }));
    setBridge({
      loadGraphSnapshot: vi.fn().mockResolvedValue({ graphSnapshot: { schemaVersion: 2, nodes: [], edges: [] } }),
      saveGraphSnapshot
    });

    const { canvasStore } = await importStore();
    await canvasStore.loadCanvasState('ws-1');

    await canvasStore.addPortalNode();
    await canvasStore.addTerminalNode();
    await canvasStore.addFileTreeNode('/tmp/ws-1');

    const graphNodes = canvasStore.getState().graphSnapshot.nodes;
    const portalNode = graphNodes.find((node) => node.componentType === 'builtin.portal');
    const terminalNode = graphNodes.find((node) => node.componentType === 'builtin.terminal');
    const fileTreeNode = graphNodes.find((node) => node.componentType === 'builtin.file-tree');

    expect(portalNode).toBeDefined();
    expect(terminalNode).toBeDefined();
    expect(fileTreeNode).toBeDefined();

    expect(
      rectanglesOverlap(
        portalNode?.bounds,
        fileTreeNode?.bounds
      )
    ).toBe(false);
    expect(
      rectanglesOverlap(
        portalNode?.bounds,
        terminalNode?.bounds
      )
    ).toBe(false);
  });

  it('selects the latest created node and keeps repeated creations visible', async () => {
    setBridge({
      loadGraphSnapshot: vi.fn().mockResolvedValue({ graphSnapshot: { schemaVersion: 2, nodes: [], edges: [] } }),
      saveGraphSnapshot: vi.fn().mockImplementation(async (input: { graphSnapshot: GraphSnapshotV2Input }) => ({
        graphSnapshot: input.graphSnapshot
      }))
    });

    const { canvasStore } = await importStore();
    await canvasStore.loadCanvasState('ws-1');

    await canvasStore.addNoteNode();
    const firstNoteId = canvasStore.getState().graphSnapshot.nodes[0]?.id ?? '';

    await canvasStore.addNoteNode();
    const graphNodes = canvasStore.getState().graphSnapshot.nodes;
    const secondNoteId = graphNodes[1]?.id ?? '';

    expect(firstNoteId).not.toBe('');
    expect(secondNoteId).not.toBe('');
    expect(canvasStore.getState().selectedNodeId).toBe(secondNoteId);
    expect(rectanglesOverlap(graphNodes[0]?.bounds, graphNodes[1]?.bounds)).toBe(false);
  });

  it('stores save failures and ignores mutations when no workspace is active', async () => {
    const saveGraphSnapshot = vi.fn().mockRejectedValue(new Error('save failed'));
    setBridge({
      loadGraphSnapshot: vi.fn().mockResolvedValue({ graphSnapshot: createGraphSnapshot() }),
      saveGraphSnapshot
    });

    const { canvasStore } = await importStore();
    await canvasStore.addNoteNode();
    expect(canvasStore.getState().nodes).toEqual([]);

    await canvasStore.loadCanvasState('ws-1');
    await canvasStore.addNoteNode();
    expect(canvasStore.getState().errorMessage).toBe('save failed');
  });



  it('ignores add-node mutations while a graph load is in progress', async () => {
    let resolveLoad: ((value: { graphSnapshot: GraphSnapshotV2Input }) => void) | null = null;
    setBridge({
      loadGraphSnapshot: vi.fn().mockImplementation(
        () =>
          new Promise<{ graphSnapshot: GraphSnapshotV2Input }>((resolve) => {
            resolveLoad = resolve;
          })
      ),
      saveGraphSnapshot: vi.fn()
    });

    const { canvasStore } = await importStore();
    const loadPromise = canvasStore.loadCanvasState('ws-1');

    await canvasStore.addNoteNode();
    expect(canvasStore.getState().graphSnapshot.nodes).toHaveLength(0);

    resolveLoad?.({ graphSnapshot: createGraphSnapshot() });
    await loadPromise;
    expect(canvasStore.getState().graphSnapshot.nodes).toHaveLength(2);
  });

  it('persists generic graph-node position updates without dropping metadata', async () => {
    const saveGraphSnapshot = vi.fn().mockImplementation(async (input: { graphSnapshot: GraphSnapshotV2Input }) => ({
      graphSnapshot: input.graphSnapshot
    }));
    setBridge({
      loadGraphSnapshot: vi.fn().mockResolvedValue({ graphSnapshot: createGraphSnapshot() }),
      saveGraphSnapshot
    });

    const { canvasStore } = await importStore();
    await canvasStore.loadCanvasState('ws-1');

    await (canvasStore as unknown as {
      updateNodePosition: (nodeId: string, position: { x: number; y: number }) => Promise<void>;
    }).updateNodePosition('node-terminal-1', { x: 300, y: 220 });

    expect(saveGraphSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({
        graphSnapshot: expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({
              id: 'node-terminal-1',
              componentType: 'builtin.terminal',
              state: expect.objectContaining({
                activeSessionId: null
              }),
              bounds: expect.objectContaining({
                x: 300,
                y: 220,
                width: 420,
                height: 260
              })
            })
          ])
        })
      })
    );
  });
});
