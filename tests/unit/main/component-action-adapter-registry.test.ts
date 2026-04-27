import { describe, expect, it } from 'vitest';
import {
  createComponentActionAdapterRegistry,
  createDefaultComponentActionAdapters,
  createDefaultComponentActionDispatcher
} from '../../../src/main/components/component-action-adapter-registry';
import type { ComponentActionAdapter } from '../../../src/main/components/component-action-dispatcher';
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
    }
  ],
  edges: []
});

describe('component action adapter registry', () => {
  const createNoopAdapter = (): ComponentActionAdapter => ({
    supports: () => false
  });

  const createReadAdapter = (content: string): ComponentActionAdapter => ({
    supports: () => false,
    read: (context) => ({
      nodeId: context.node.id,
      action: 'read',
      result: {
        content
      }
    })
  });

  it('registers adapters by exact component type and composes dispatcher adapters', () => {
    const registry = createComponentActionAdapterRegistry();

    registry.register({
      componentType: 'external.note-plus',
      source: 'external',
      adapter: createNoopAdapter()
    });
    registry.register({
      componentType: 'custom.foo',
      source: 'custom',
      adapter: createNoopAdapter()
    });

    const adapters = registry.createAdapters();

    expect(adapters).toHaveLength(2);
    expect(adapters[0]?.supports('external.note-plus')).toBe(true);
    expect(adapters[0]?.supports('custom.foo')).toBe(false);
    expect(adapters[1]?.supports('custom.foo')).toBe(true);
    expect(adapters[1]?.supports('external.note-plus')).toBe(false);
  });

  it('creates a dispatcher for external registrations', () => {
    const registry = createComponentActionAdapterRegistry();
    const graph = createGraph();
    const externalNode = {
      ...graph.nodes[0],
      id: 'node-external-1',
      componentType: 'external.note-plus'
    };

    registry.register({
      componentType: 'external.note-plus',
      source: 'external',
      adapter: createReadAdapter('external content')
    });

    expect(
      registry.createDispatcher().read(
        {
          workspaceId: 'ws-1',
          graph: {
            ...graph,
            nodes: [externalNode, graph.nodes[1]]
          },
          node: externalNode,
          saveGraph: () => {
            throw new Error('saveGraph should not be called for read');
          }
        },
        {}
      )
    ).toEqual({
      nodeId: 'node-external-1',
      action: 'read',
      result: {
        content: 'external content'
      }
    });
  });

  it('rejects non-builtin registrations for builtin component types and keeps registry unchanged', () => {
    const registry = createComponentActionAdapterRegistry();

    expect(() =>
      registry.register({
        componentType: 'builtin.note',
        source: 'external',
        adapter: createNoopAdapter()
      })
    ).toThrow('Non-builtin adapter cannot register builtin component type: builtin.note');

    expect(registry.createAdapters()).toHaveLength(0);
  });

  it('rejects builtin registrations for non-builtin component types', () => {
    const registry = createComponentActionAdapterRegistry();

    expect(() =>
      registry.register({
        componentType: 'external.note-plus',
        source: 'builtin',
        adapter: createNoopAdapter()
      })
    ).toThrow('Builtin adapter must register builtin component type: external.note-plus');

    expect(registry.createAdapters()).toHaveLength(0);
  });

  it('rejects duplicate registrations for the same component type', () => {
    const registry = createComponentActionAdapterRegistry();
    registry.register({
      componentType: 'external.note-plus',
      source: 'external',
      adapter: createReadAdapter('original')
    });

    expect(() =>
      registry.register({
        componentType: 'external.note-plus',
        source: 'external',
        adapter: createNoopAdapter()
      })
    ).toThrow('Component action adapter already registered for component type: external.note-plus');

    expect(() =>
      registry.register({
        componentType: 'external.note-plus',
        source: 'custom',
        adapter: createNoopAdapter()
      })
    ).toThrow('Component action adapter already registered for component type: external.note-plus');

    const adapters = registry.createAdapters();

    expect(adapters).toHaveLength(1);
    expect(adapters[0]?.supports('external.note-plus')).toBe(true);
    expect(adapters[0]?.supports('custom.foo')).toBe(false);
    expect(
      registry.createDispatcher().read(
        {
          workspaceId: 'ws-1',
          graph: {
            ...createGraph(),
            nodes: [
              {
                ...createGraph().nodes[0],
                id: 'node-external-1',
                componentType: 'external.note-plus'
              }
            ]
          },
          node: {
            ...createGraph().nodes[0],
            id: 'node-external-1',
            componentType: 'external.note-plus'
          },
          saveGraph: () => {
            throw new Error('saveGraph should not be called for read');
          }
        },
        {}
      )
    ).toEqual({
      nodeId: 'node-external-1',
      action: 'read',
      result: {
        content: 'original'
      }
    });
  });

  it('exposes builtin.note, builtin.text, builtin.attachment, and builtin.terminal default adapters', () => {
    const adapters = createDefaultComponentActionAdapters();

    expect(adapters).toHaveLength(4);
    expect(adapters[0]?.supports('builtin.note')).toBe(true);
    expect(adapters[1]?.supports('builtin.text')).toBe(true);
    expect(adapters[2]?.supports('builtin.attachment')).toBe(true);
    expect(adapters[3]?.supports('builtin.terminal')).toBe(true);
    expect(adapters[0]?.supports('builtin.terminal')).toBe(false);
  });

  it('creates a default dispatcher from default adapters', () => {
    const dispatcher = createDefaultComponentActionDispatcher();
    const graph = createGraph();
    const saveGraph = (): void => {
      throw new Error('saveGraph should not be called for read');
    };

    expect(
      dispatcher.read(
        {
          workspaceId: 'ws-1',
          graph,
          node: graph.nodes[0],
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
          graph: {
            ...graph,
            nodes: [
              ...graph.nodes,
              {
                ...graph.nodes[0],
                id: 'node-text-1',
                componentType: 'builtin.text',
                title: 'Text',
                state: {
                  content: 'text'
                },
                capabilities: ['read']
              },
              {
                ...graph.nodes[0],
                id: 'node-attachment-1',
                componentType: 'builtin.attachment',
                title: 'Attachment',
                state: {
                  attachments: [
                    {
                      id: 'att-1',
                      name: 'design.pdf',
                      path: '/tmp/design.pdf'
                    }
                  ]
                },
                capabilities: ['read']
              }
            ]
          },
          node: {
            ...graph.nodes[0],
            id: 'node-text-1',
            componentType: 'builtin.text',
            title: 'Text',
            state: {
              content: 'text'
            },
            capabilities: ['read']
          },
          saveGraph
        },
        {}
      )
    ).toEqual({
      nodeId: 'node-text-1',
      action: 'read',
      result: {
        content: 'text'
      }
    });

    expect(
      dispatcher.read(
        {
          workspaceId: 'ws-1',
          graph: {
            ...graph,
            nodes: [
              ...graph.nodes,
              {
                ...graph.nodes[0],
                id: 'node-attachment-1',
                componentType: 'builtin.attachment',
                title: 'Attachment',
                state: {
                  attachments: [
                    {
                      id: 'att-1',
                      name: 'design.pdf',
                      path: '/tmp/design.pdf'
                    }
                  ]
                },
                capabilities: ['read']
              }
            ]
          },
          node: {
            ...graph.nodes[0],
            id: 'node-attachment-1',
            componentType: 'builtin.attachment',
            title: 'Attachment',
            state: {
              attachments: [
                {
                  id: 'att-1',
                  name: 'design.pdf',
                  path: '/tmp/design.pdf'
                }
              ]
            },
            capabilities: ['read']
          },
          saveGraph
        },
        {}
      )
    ).toEqual({
      nodeId: 'node-attachment-1',
      action: 'read',
      result: {
        content: '1 attachment: design.pdf',
        count: 1,
        attachments: [
          {
            id: 'att-1',
            name: 'design.pdf',
            path: '/tmp/design.pdf',
            mimeType: null,
            sizeBytes: null
          }
        ]
      }
    });

    expect(() =>
      dispatcher.read(
        {
          workspaceId: 'ws-1',
          graph,
          node: graph.nodes[1],
          saveGraph
        },
        {}
      )
    ).toThrow('NODE_ACTION_NOT_SUPPORTED');
  });
});
