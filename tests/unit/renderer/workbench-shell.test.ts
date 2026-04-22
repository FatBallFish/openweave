import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WorkbenchInspector } from '../../../src/renderer/features/workbench/WorkbenchInspector';
import { I18nProvider } from '../../../src/renderer/i18n/provider';

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
    const html = renderToStaticMarkup(createElement(I18nProvider, null, createElement(App)));

    expect(html).toContain('data-testid="workbench-overlay-stage"');
    expect(html).toContain('data-testid="workbench-context-panel"');
    expect(html).toContain('data-testid="workbench-topbar"');
    expect(html).toContain('data-testid="workbench-topbar-create-cluster"');
    expect(html).toContain('data-testid="workbench-inspector"');
    expect(html).toContain('data-testid="workbench-status-island"');
    expect(html).not.toContain('ow-workbench-layout');
  });

  it('renders inspector with collapse button and scrollable body', () => {
    const html = renderToStaticMarkup(
      createElement(
        I18nProvider,
        null,
        createElement(WorkbenchInspector, {
          workspaceName: 'Alpha Workspace',
          workspaceRootDir: '/tmp/alpha',
          onToggle: vi.fn()
        })
      )
    );

    expect(html).toContain('data-testid="workbench-inspector"');
    expect(html).toContain('title="收起检查器"');
    expect(html).toContain('工作区根目录');
    expect(html).toContain('class="ow-workbench-inspector__body"');
  });
});
