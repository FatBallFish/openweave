// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../src/renderer/i18n/provider';

const mockWorkspacesState = {
  workspaces: [] as Array<{
    id: string;
    name: string;
    rootDir: string;
    createdAtMs: number;
    updatedAtMs: number;
    lastOpenedAtMs: number | null;
  }>,
  activeWorkspaceId: null as string | null
};

const workspaceListPageMock = vi.fn(
  ({ variant }: { variant?: 'page' | 'panel' }) =>
    createElement('div', { 'data-testid': 'workspace-list-page-stub', 'data-variant': variant }, 'workspace list')
);

const mockCanvasState = {
  loading: false,
  selectedNodeId: null as string | null,
  graphSnapshot: {
    schemaVersion: 2,
    nodes: [],
    edges: []
  }
};

vi.mock('../../../src/renderer/features/workspaces/workspaces.store', () => ({
  useWorkspacesStore: <T,>(selector: (storeState: typeof mockWorkspacesState) => T): T =>
    selector(mockWorkspacesState)
}));

vi.mock('../../../src/renderer/features/workspaces/WorkspaceListPage', () => ({
  WorkspaceListPage: (props: { variant?: 'page' | 'panel' }): JSX.Element => workspaceListPageMock(props)
}));

vi.mock('../../../src/renderer/features/canvas/canvas.store', () => ({
  useCanvasStore: <T,>(selector: (storeState: typeof mockCanvasState) => T): T => selector(mockCanvasState),
  canvasStore: {
    addTerminalNode: vi.fn(),
    addNoteNode: vi.fn(),
    addPortalNode: vi.fn(),
    addFileTreeNode: vi.fn(),
    addTextNode: vi.fn()
  }
}));

vi.mock('../../../src/renderer/features/canvas/WorkspaceCanvasPage', () => ({
  WorkspaceCanvasPage: ({ workspaceName }: { workspaceName: string }): JSX.Element =>
    createElement('div', { 'data-testid': 'workspace-canvas-page-stub' }, workspaceName)
}));

import { App } from '../../../src/renderer/App';

const readRendererFile = (relativePath: string): string => {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
};

describe('app shell', () => {
  beforeEach(() => {
    workspaceListPageMock.mockClear();
    mockCanvasState.loading = false;
  });

  it('renders the workbench shell root instead of the demo document shell', () => {
    mockWorkspacesState.workspaces = [];
    mockWorkspacesState.activeWorkspaceId = null;

    const html = renderToStaticMarkup(createElement(I18nProvider, null, createElement(App)));

    expect(html).toContain('data-testid="workbench-shell"');
    expect(html).toContain('data-testid="workbench-topbar"');
    expect(html).toContain('data-testid="workbench-overlay-stage"');
    expect(html).toContain('选择或创建工作区');
    expect(html).not.toContain('Electron shell ready for MVP tasks.');
    expect(html).not.toContain('ow-workbench-layout');
    expect(workspaceListPageMock).toHaveBeenCalledTimes(1);
    expect(workspaceListPageMock.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ variant: 'panel' }));
  });

  it('keeps the active workspace branch wired into the canvas page inside the shared stage shell', () => {
    mockWorkspacesState.workspaces = [
      {
        id: 'ws-1',
        name: 'Alpha Workspace',
        rootDir: '/tmp/alpha',
        createdAtMs: 1,
        updatedAtMs: 1,
        lastOpenedAtMs: null
      }
    ];
    mockWorkspacesState.activeWorkspaceId = 'ws-1';

    const html = renderToStaticMarkup(createElement(I18nProvider, null, createElement(App)));

    expect(html).toContain('data-testid="workspace-canvas-page-stub"');
    expect(html).toContain('Alpha Workspace');
    expect(html).toContain('data-testid="workbench-stage"');
    expect(html).not.toContain('data-testid="workbench-stage-empty"');
  });

  it('renders the topbar in English when the locale is switched to en-US', () => {
    mockWorkspacesState.workspaces = [];
    mockWorkspacesState.activeWorkspaceId = null;

    const html = renderToStaticMarkup(createElement(I18nProvider, { locale: 'en-US' }, createElement(App)));

    expect(html).toContain('Select or create a workspace');
  });

  it('uses semantic shell tokens so dark parity can remap the same surfaces', () => {
    const tokensCss = readRendererFile('src/renderer/styles/tokens.css');
    const workbenchCss = readRendererFile('src/renderer/styles/workbench.css');

    expect(tokensCss).toContain('--ow-accent-rgb');
    expect(tokensCss).toContain('--ow-dark-accent-rgb');
    expect(workbenchCss).toContain('rgba(var(--ow-accent-rgb), 0.14)');
    expect(workbenchCss).toContain('rgba(var(--ow-surface-rgb), 0.56)');
    expect(workbenchCss).not.toContain('rgba(13, 110, 253, 0.14)');
    expect(workbenchCss).not.toContain('rgba(255, 255, 255, 0.56)');
  });
});
