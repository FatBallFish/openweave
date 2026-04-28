// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Position } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';
import {
  CanvasShell,
  projectGraphToCanvasShell
} from '../../../src/renderer/features/canvas-shell/CanvasShell';
import { ConnectEdge } from '../../../src/renderer/features/canvas-shell/edge-types/ConnectEdge';
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

  it('renders workbench canvas chrome around builtin hosts', () => {
    const html = renderToStaticMarkup(
      createElement(CanvasShell, {
        fitViewRequestId: 0,
        workspaceId: 'ws-1',
        workspaceRootDir: '/tmp/ws-1',
        graphSnapshot: createGraphSnapshot(),
        onOpenCommandPalette: vi.fn(),
        onOpenQuickAdd: vi.fn(),
        onSelectNode: vi.fn(),
        onAddTerminal: vi.fn(),
        onAddNote: vi.fn(),
        onAddPortal: vi.fn(),
        onAddFileTree: vi.fn(),
        onAddText: vi.fn(),
        onOpenRun: vi.fn(),
        onCreateBranchWorkspace: vi.fn(),
        onMoveNode: vi.fn(),
        onResizeNode: vi.fn(),
        placementMode: null,
        onPlacementComplete: vi.fn(),
        onPlacementCancel: vi.fn()
      })
    );

    expect(html).toContain('canvas-shell');
    expect(html).toContain('canvas-shell-flow');
    expect(html).toContain('canvas-shell-minimap');
    expect(html).not.toContain('react-flow__controls');
    expect(html).not.toContain('canvas-shell-grid');
    expect(html).not.toContain('command-palette-trigger');
    expect(html).not.toContain('canvas-quick-add-trigger');
    expect(html).toContain('canvas-viewport-controls');
  });

  it('projects directional ReactFlow handles and chooses endpoints by relative node position', () => {
    const model = projectGraphToCanvasShell({
      workspaceId: 'ws-1',
      workspaceRootDir: '/tmp/ws-1',
      graphSnapshot: createGraphSnapshot(),
      onOpenRun: vi.fn(),
      onCreateBranchWorkspace: vi.fn()
    });

    expect(model.nodes[0]?.handles).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'source-right', type: 'source', x: 320, y: 120 }),
      expect.objectContaining({ id: 'source-bottom', type: 'source', x: 160, y: 240 }),
      expect.objectContaining({ id: 'target-left', type: 'target', x: 0, y: 120 }),
      expect.objectContaining({ id: 'target-top', type: 'target', x: 160, y: 0 })
    ]));
    expect(model.edges[0]).toEqual(expect.objectContaining({
      sourceHandle: 'source-right',
      targetHandle: 'target-left',
      data: expect.objectContaining({
        route: expect.objectContaining({
          sourcePosition: 'right',
          targetPosition: 'left'
        })
      })
    }));
  });

  it('uses vertical endpoints when target is above or below the source', () => {
    const snapshot = createGraphSnapshot();
    snapshot.nodes[1].bounds = {
      x: 130,
      y: 520,
      width: 420,
      height: 260
    };

    const model = projectGraphToCanvasShell({
      workspaceId: 'ws-1',
      workspaceRootDir: '/tmp/ws-1',
      graphSnapshot: snapshot,
      onOpenRun: vi.fn(),
      onCreateBranchWorkspace: vi.fn()
    });

    expect(model.edges[0]).toEqual(expect.objectContaining({
      sourceHandle: 'source-bottom',
      targetHandle: 'target-top',
      data: expect.objectContaining({
        route: expect.objectContaining({
          sourcePosition: 'bottom',
          targetPosition: 'top'
        })
      })
    }));
  });

  it('renders connection edges as thicker curved paths by default', () => {
    const html = renderToStaticMarkup(
      createElement(ConnectEdge, {
        id: 'edge-note-terminal',
        source: 'node-note-1',
        target: 'node-terminal-1',
        sourceX: 420,
        sourceY: 240,
        targetX: 520,
        targetY: 270,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        selected: false,
        data: {}
      })
    );

    expect(html).toContain('stroke-width:2.2');
    expect(html).toContain('C');
  });
});
