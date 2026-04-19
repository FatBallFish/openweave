import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  CanvasShell,
  projectGraphToCanvasShell
} from '../../../src/renderer/features/canvas-shell/CanvasShell';
import type { GraphSnapshotV2Input } from '../../../src/shared/ipc/schemas';

const createGraphSnapshot = (): GraphSnapshotV2Input => ({
  schemaVersion: 2,
  nodes: [
    {
      id: 'node-note-1',
      componentType: 'builtin.note',
      componentVersion: '1.0.0',
      title: 'Note',
      bounds: {
        x: 100,
        y: 120,
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
        x: 520,
        y: 140,
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
  edges: [
    {
      id: 'edge-note-terminal',
      source: 'node-note-1',
      target: 'node-terminal-1',
      sourceHandle: 'context',
      targetHandle: 'input',
      label: 'context',
      meta: {
        kind: 'context'
      },
      createdAtMs: 5,
      updatedAtMs: 6
    }
  ]
});

describe('canvas shell', () => {
  it('projects graph nodes and edges into a graph-canvas model', () => {
    const model = projectGraphToCanvasShell({
      workspaceId: 'ws-1',
      workspaceRootDir: '/tmp/ws-1',
      graphSnapshot: createGraphSnapshot(),
      onOpenRun: vi.fn(),
      onCreateBranchWorkspace: vi.fn()
    });

    expect(model.nodes).toHaveLength(2);
    expect(model.nodes[0]).toMatchObject({
      id: 'node-note-1',
      type: 'builtinHost',
      position: {
        x: 100,
        y: 120
      },
      style: {
        width: 320,
        height: 240
      }
    });
    expect(model.edges).toEqual([
      expect.objectContaining({
        id: 'edge-note-terminal',
        source: 'node-note-1',
        target: 'node-terminal-1',
        label: 'context'
      })
    ]);
  });

  it('renders a real canvas-shell container around builtin hosts', () => {
    const html = renderToStaticMarkup(
      createElement(CanvasShell, {
        workspaceId: 'ws-1',
        workspaceRootDir: '/tmp/ws-1',
        graphSnapshot: createGraphSnapshot(),
        onOpenRun: vi.fn(),
        onCreateBranchWorkspace: vi.fn(),
        onMoveNode: vi.fn()
      })
    );

    expect(html).toContain('canvas-shell');
    expect(html).toContain('canvas-shell-flow');
  });
});
