import { describe, expect, it } from 'vitest';
import { createComponentActionDispatcher } from '../../../src/main/components/component-action-dispatcher';
import { createBuiltinAttachmentActionAdapter } from '../../../src/main/components/action-adapters/builtin-attachment-action-adapter';
import { createBuiltinNoteActionAdapter } from '../../../src/main/components/action-adapters/builtin-note-action-adapter';
import { createBuiltinTextActionAdapter } from '../../../src/main/components/action-adapters/builtin-text-action-adapter';
import type { GraphSnapshotV2Input } from '../../../src/shared/ipc/schemas';

const createGraph = (): GraphSnapshotV2Input => ({
  schemaVersion: 2,
  nodes: [
    {
      id: 'node-note-1',
      componentType: 'builtin.note',
      componentVersion: '1.0.0',
      title: 'Note',
      bounds: {
        x: 10,
        y: 20,
        width: 320,
        height: 240
      },
      config: {
        mode: 'markdown'
      },
      state: {
        content: '# hello'
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
        x: 400,
        y: 20,
        width: 420,
        height: 260
      },
      config: {
        runtime: 'shell'
      },
      state: {
        activeSessionId: null
      },
      capabilities: ['read', 'write', 'execute', 'stream'],
      createdAtMs: 3,
      updatedAtMs: 4
    },
    {
      id: 'node-text-1',
      componentType: 'builtin.text',
      componentVersion: '1.0.0',
      title: 'Text',
      bounds: {
        x: 10,
        y: 320,
        width: 320,
        height: 240
      },
      config: {
        mode: 'plain'
      },
      state: {
        content: 'hello text'
      },
      capabilities: ['read'],
      createdAtMs: 5,
      updatedAtMs: 6
    },
    {
      id: 'node-attachment-1',
      componentType: 'builtin.attachment',
      componentVersion: '1.0.0',
      title: 'Attachment',
      bounds: {
        x: 400,
        y: 320,
        width: 420,
        height: 260
      },
      config: {},
      state: {
        attachments: [
          {
            id: 'att-1',
            name: 'design.pdf',
            path: '/tmp/design.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1234
          },
          {
            id: 'att-2',
            path: '/tmp/notes.txt'
          },
          {
            id: 'att-3',
            name: 'ignored.txt',
            sizeBytes: -5
          }
        ]
      },
      capabilities: ['read'],
      createdAtMs: 7,
      updatedAtMs: 8
    }
  ],
  edges: []
});

describe('component action dispatcher', () => {
  it('dispatches builtin.note read for default mode and content mode', () => {
    const dispatcher = createComponentActionDispatcher({
      adapters: [createBuiltinNoteActionAdapter()]
    });
    const graph = createGraph();
    const node = graph.nodes[0];
    const saveGraph = (): void => {
      throw new Error('saveGraph should not be called for read');
    };

    expect(
      dispatcher.read(
        {
          workspaceId: 'ws-1',
          graph,
          node,
          saveGraph
        },
        {}
      )
    ).toEqual({
      nodeId: 'node-note-1',
      action: 'read',
      result: {
        content: '# hello'
      }
    });

    expect(
      dispatcher.read(
        {
          workspaceId: 'ws-1',
          graph,
          node,
          saveGraph
        },
        { mode: 'content' }
      )
    ).toEqual({
      nodeId: 'node-note-1',
      action: 'read',
      result: {
        content: '# hello'
      }
    });
  });

  it('dispatches builtin.text read for default mode and content mode', () => {
    const dispatcher = createComponentActionDispatcher({
      adapters: [createBuiltinTextActionAdapter()]
    });
    const graph = createGraph();
    const node = graph.nodes[2];
    const saveGraph = (): void => {
      throw new Error('saveGraph should not be called for read');
    };

    expect(
      dispatcher.read(
        {
          workspaceId: 'ws-1',
          graph,
          node,
          saveGraph
        },
        {}
      )
    ).toEqual({
      nodeId: 'node-text-1',
      action: 'read',
      result: {
        content: 'hello text'
      }
    });

    expect(
      dispatcher.read(
        {
          workspaceId: 'ws-1',
          graph,
          node,
          saveGraph
        },
        { mode: 'content' }
      )
    ).toEqual({
      nodeId: 'node-text-1',
      action: 'read',
      result: {
        content: 'hello text'
      }
    });
  });

  it('dispatches builtin.attachment read for default mode and content mode', () => {
    const dispatcher = createComponentActionDispatcher({
      adapters: [createBuiltinAttachmentActionAdapter()]
    });
    const graph = createGraph();
    const node = graph.nodes[3];
    const saveGraph = (): void => {
      throw new Error('saveGraph should not be called for read');
    };

    expect(
      dispatcher.read(
        {
          workspaceId: 'ws-1',
          graph,
          node,
          saveGraph
        },
        {}
      )
    ).toEqual({
      nodeId: 'node-attachment-1',
      action: 'read',
      result: {
        content: '2 attachments: design.pdf, notes.txt',
        count: 2,
        attachments: [
          {
            id: 'att-1',
            name: 'design.pdf',
            path: '/tmp/design.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1234
          },
          {
            id: 'att-2',
            name: 'notes.txt',
            path: '/tmp/notes.txt',
            mimeType: null,
            sizeBytes: null
          }
        ]
      }
    });

    expect(
      dispatcher.read(
        {
          workspaceId: 'ws-1',
          graph,
          node,
          saveGraph
        },
        { mode: 'content' }
      )
    ).toEqual({
      nodeId: 'node-attachment-1',
      action: 'read',
      result: {
        content: '2 attachments: design.pdf, notes.txt',
        count: 2,
        attachments: [
          {
            id: 'att-1',
            name: 'design.pdf',
            path: '/tmp/design.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1234
          },
          {
            id: 'att-2',
            name: 'notes.txt',
            path: '/tmp/notes.txt',
            mimeType: null,
            sizeBytes: null
          }
        ]
      }
    });
  });

  it('dispatches builtin.note write and persists through saveGraph callback', () => {
    const dispatcher = createComponentActionDispatcher({
      adapters: [createBuiltinNoteActionAdapter()]
    });
    const graph = createGraph();
    const node = graph.nodes[0];
    let persistedGraph: GraphSnapshotV2Input | null = null;

    const response = dispatcher.action(
      {
        workspaceId: 'ws-1',
        graph,
        node,
        saveGraph: (nextGraph) => {
          persistedGraph = nextGraph;
        }
      },
      {
        action: 'write',
        payload: {
          content: 'updated'
        }
      }
    );

    expect(response).toEqual({
      nodeId: 'node-note-1',
      action: 'write',
      ok: true,
      result: {
        updated: true
      }
    });
    expect(persistedGraph).not.toBeNull();
    expect(persistedGraph?.nodes.find((candidate) => candidate.id === 'node-note-1')?.state.content).toBe(
      'updated'
    );
    expect(
      persistedGraph?.nodes.find((candidate) => candidate.id === 'node-note-1')?.updatedAtMs
    ).toBeGreaterThan(2);
  });

  it('throws NODE_ACTION_NOT_SUPPORTED for unsupported component/action/mode', () => {
    const dispatcher = createComponentActionDispatcher({
      adapters: [
        createBuiltinNoteActionAdapter(),
        createBuiltinTextActionAdapter(),
        createBuiltinAttachmentActionAdapter()
      ]
    });
    const graph = createGraph();
    const terminalNode = graph.nodes[1];
    const noteNode = graph.nodes[0];
    const textNode = graph.nodes[2];
    const attachmentNode = graph.nodes[3];
    const saveGraph = (): void => {};

    expect(() =>
      dispatcher.read(
        {
          workspaceId: 'ws-1',
          graph,
          node: terminalNode,
          saveGraph
        },
        {}
      )
    ).toThrow('NODE_ACTION_NOT_SUPPORTED');

    expect(() =>
      dispatcher.read(
        {
          workspaceId: 'ws-1',
          graph,
          node: noteNode,
          saveGraph
        },
        { mode: 'summary' }
      )
    ).toThrow('NODE_ACTION_NOT_SUPPORTED');

    expect(() =>
      dispatcher.read(
        {
          workspaceId: 'ws-1',
          graph,
          node: textNode,
          saveGraph
        },
        { mode: 'summary' }
      )
    ).toThrow('NODE_ACTION_NOT_SUPPORTED');

    expect(() =>
      dispatcher.action(
        {
          workspaceId: 'ws-1',
          graph,
          node: textNode,
          saveGraph
        },
        {
          action: 'write'
        }
      )
    ).toThrow('NODE_ACTION_NOT_SUPPORTED');

    expect(() =>
      dispatcher.read(
        {
          workspaceId: 'ws-1',
          graph,
          node: attachmentNode,
          saveGraph
        },
        { mode: 'summary' }
      )
    ).toThrow('NODE_ACTION_NOT_SUPPORTED');

    expect(() =>
      dispatcher.action(
        {
          workspaceId: 'ws-1',
          graph,
          node: attachmentNode,
          saveGraph
        },
        {
          action: 'write'
        }
      )
    ).toThrow('NODE_ACTION_NOT_SUPPORTED');

    expect(() =>
      dispatcher.action(
        {
          workspaceId: 'ws-1',
          graph,
          node: noteNode,
          saveGraph
        },
        {
          action: 'summarize'
        }
      )
    ).toThrow('NODE_ACTION_NOT_SUPPORTED');
  });
});
