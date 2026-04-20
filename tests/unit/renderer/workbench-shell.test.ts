import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WorkbenchInspector } from '../../../src/renderer/features/workbench/WorkbenchInspector';

const mockWorkspacesState = {
  workspaces: [],
  activeWorkspaceId: null
};

vi.mock('../../../src/renderer/features/workspaces/workspaces.store', () => ({
  useWorkspacesStore: <T,>(selector: (storeState: typeof mockWorkspacesState) => T): T =>
    selector(mockWorkspacesState)
}));

vi.mock('../../../src/renderer/features/workspaces/WorkspaceListPage', () => ({
  WorkspaceListPage: (): JSX.Element =>
    createElement('div', { 'data-testid': 'workspace-list-page-stub' }, 'workspace list')
}));

vi.mock('../../../src/renderer/features/canvas/WorkspaceCanvasPage', () => ({
  WorkspaceCanvasPage: (): JSX.Element =>
    createElement('div', { 'data-testid': 'workspace-canvas-page-stub' }, 'workspace canvas')
}));

import { App } from '../../../src/renderer/App';

describe('workbench shell layout', () => {
  it('renders the approved workbench shell regions', () => {
    const html = renderToStaticMarkup(createElement(App));

    expect(html).toContain('data-testid="workbench-left-rail"');
    expect(html).toContain('data-testid="workbench-context-panel"');
    expect(html).toContain('data-testid="workbench-topbar"');
    expect(html).toContain('data-testid="workbench-inspector"');
    expect(html).toContain('data-testid="workbench-status-island"');
  });

  it('renders a collapsed inspector mode for the workbench shell', () => {
    const html = renderToStaticMarkup(
      createElement(WorkbenchInspector, {
        workspaceName: 'Alpha Workspace',
        workspaceRootDir: '/tmp/alpha',
        collapsed: true,
        onToggle: vi.fn()
      })
    );

    expect(html).toContain('data-testid="workbench-inspector-collapsed"');
    expect(html).toContain('Expand');
    expect(html).not.toContain('Workspace root');
  });
});
