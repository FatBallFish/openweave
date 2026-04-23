// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  loadCanvasState: vi.fn().mockResolvedValue(undefined),
  updateNodeBounds: vi.fn().mockResolvedValue(undefined),
  addNoteNode: vi.fn().mockResolvedValue(undefined),
  addPortalNode: vi.fn().mockResolvedValue(undefined),
  addFileTreeNode: vi.fn().mockResolvedValue(undefined),
  addTextNode: vi.fn().mockResolvedValue(undefined),
  updateNodePosition: vi.fn().mockResolvedValue(undefined),
  openBranchDialog: vi.fn(),
  runDrawerProps: [] as Array<{ workspaceId: string; runId: string | null }>
}));

vi.mock('../../../src/renderer/i18n/provider', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}));

vi.mock('../../../src/renderer/features/workspaces/workspaces.store', () => ({
  workspacesStore: {
    openBranchDialog: mocked.openBranchDialog
  }
}));

vi.mock('../../../src/renderer/features/canvas/canvas.store', () => ({
  canvasStore: {
    loadCanvasState: mocked.loadCanvasState,
    updateNodeBounds: mocked.updateNodeBounds,
    addNoteNode: mocked.addNoteNode,
    addPortalNode: mocked.addPortalNode,
    addFileTreeNode: mocked.addFileTreeNode,
    addTextNode: mocked.addTextNode,
    updateNodePosition: mocked.updateNodePosition
  },
  useCanvasStore: (selector: (state: { graphSnapshot: { nodes: []; edges: [] }; loading: boolean; errorMessage: null }) => unknown) =>
    selector({
      graphSnapshot: { nodes: [], edges: [] },
      loading: false,
      errorMessage: null
    })
}));

vi.mock('../../../src/renderer/features/canvas-shell/CanvasShell', () => ({
  CanvasShell: ({
    workspaceId,
    onOpenRun
  }: {
    workspaceId: string;
    onOpenRun: (runId: string) => void;
  }): JSX.Element =>
    createElement(
      'button',
      {
        type: 'button',
        'data-testid': `open-run-${workspaceId}`,
        onClick: () => onOpenRun(`run-${workspaceId}`)
      },
      `open-${workspaceId}`
    )
}));

vi.mock('../../../src/renderer/features/runs/RunDrawer', () => ({
  RunDrawer: ({ workspaceId, runId }: { workspaceId: string; runId: string | null }): JSX.Element => {
    mocked.runDrawerProps.push({ workspaceId, runId });
    return createElement('div', {
      'data-testid': 'run-drawer-props',
      'data-workspace-id': workspaceId,
      'data-run-id': runId ?? ''
    });
  }
}));

import { WorkspaceCanvasPage } from '../../../src/renderer/features/canvas/WorkspaceCanvasPage';

describe('WorkspaceCanvasPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.runDrawerProps.length = 0;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('does not pass a stale run id into the next workspace while switching', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(WorkspaceCanvasPage, {
          fitViewRequestId: 1,
          workspaceId: 'ws-1',
          workspaceName: 'Workspace 1',
          workspaceRootDir: '/tmp/ws-1',
          onOpenCommandPalette: () => {},
          onOpenQuickAdd: () => {},
          onSelectNode: () => {},
          onAddTerminal: () => {}
        })
      );
      await Promise.resolve();
    });

    const openRunButton = container.querySelector('[data-testid="open-run-ws-1"]') as HTMLButtonElement;
    await act(async () => {
      openRunButton.click();
      await Promise.resolve();
    });

    expect(mocked.runDrawerProps.at(-1)).toEqual({ workspaceId: 'ws-1', runId: 'run-ws-1' });

    await act(async () => {
      root.render(
        createElement(WorkspaceCanvasPage, {
          fitViewRequestId: 1,
          workspaceId: 'ws-2',
          workspaceName: 'Workspace 2',
          workspaceRootDir: '/tmp/ws-2',
          onOpenCommandPalette: () => {},
          onOpenQuickAdd: () => {},
          onSelectNode: () => {},
          onAddTerminal: () => {}
        })
      );
      await Promise.resolve();
    });

    expect(mocked.runDrawerProps).not.toContainEqual({ workspaceId: 'ws-2', runId: 'run-ws-1' });
    expect(mocked.runDrawerProps.at(-1)).toEqual({ workspaceId: 'ws-2', runId: null });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
