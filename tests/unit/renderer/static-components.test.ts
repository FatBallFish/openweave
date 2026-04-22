import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GitPanel } from '../../../src/renderer/features/git/GitPanel';
import { PortalToolbar } from '../../../src/renderer/features/portal/PortalToolbar';
import { WorkbenchContextPanel } from '../../../src/renderer/features/workbench/WorkbenchContextPanel';
import { WorkbenchTopBar } from '../../../src/renderer/features/workbench/WorkbenchTopBar';
import { BranchWorkspaceDialog } from '../../../src/renderer/features/workspaces/BranchWorkspaceDialog';
import { I18nProvider } from '../../../src/renderer/i18n/provider';

describe('renderer static components', () => {
  it('renders branch workspace dialog only when source workspace exists', () => {
    const hidden = renderToStaticMarkup(
      createElement(BranchWorkspaceDialog, {
        open: false,
        loading: false,
        sourceWorkspace: null,
        onCancel: vi.fn(),
        onCreate: async () => {}
      })
    );
    const visible = renderToStaticMarkup(
      createElement(BranchWorkspaceDialog, {
        open: true,
        loading: false,
        sourceWorkspace: {
          id: 'ws-1',
          name: 'Main Workspace',
          rootDir: '/tmp/ws-1',
          createdAtMs: 1,
          updatedAtMs: 1,
          lastOpenedAtMs: null
        },
        onCancel: vi.fn(),
        onCreate: async () => {}
      })
    );

    expect(hidden).toBe('');
    expect(visible).toContain('Create branch workspace');
    expect(visible).toContain('Source workspace: Main Workspace');
    expect(visible).toContain('feature/demo');
  });

  it('renders an orchestration-first topbar and a secondary canvas guidance strip', () => {
    const topBar = renderToStaticMarkup(
      createElement(
        I18nProvider,
        null,
        createElement(WorkbenchTopBar, {
          workspaceName: 'Alpha Workspace',
          commandMenuDisabled: false,
          quickAddDisabled: false,
          disabled: false,
          fitViewDisabled: false,
          inspectorDisabled: false,
          onAddTerminal: vi.fn(),
          onAddNote: vi.fn(),
          onAddPortal: vi.fn(),
          onAddFileTree: vi.fn(),
          onAddText: vi.fn(),
          onOpenCommandMenu: vi.fn(),
          onOpenQuickAdd: vi.fn(),
          onFitCanvas: vi.fn(),
          onToggleInspector: vi.fn()
        })
      )
    );
    const englishTopBar = renderToStaticMarkup(
      createElement(
        I18nProvider,
        { locale: 'en-US' },
        createElement(WorkbenchTopBar, {
          workspaceName: 'Alpha Workspace',
          commandMenuDisabled: false,
          quickAddDisabled: false,
          disabled: false,
          fitViewDisabled: false,
          inspectorDisabled: false,
          onAddTerminal: vi.fn(),
          onAddNote: vi.fn(),
          onAddPortal: vi.fn(),
          onAddFileTree: vi.fn(),
          onAddText: vi.fn(),
          onOpenCommandMenu: vi.fn(),
          onOpenQuickAdd: vi.fn(),
          onFitCanvas: vi.fn(),
          onToggleInspector: vi.fn()
        })
      )
    );
    const portalToolbar = renderToStaticMarkup(
      createElement(PortalToolbar, {
        nodeId: 'portal-1',
        commandMenuDisabled: true,
        searchDisabled: true,
        disabled: false,
        fitViewDisabled: true,
        url: 'https://example.com',
        clickSelector: '#action',
        inputSelector: '#message',
        inputValue: 'hello',
        onUrlChange: vi.fn(),
        onClickSelectorChange: vi.fn(),
        onInputSelectorChange: vi.fn(),
        onInputValueChange: vi.fn(),
        onLoad: vi.fn(),
        onCapture: vi.fn(),
        onReadStructure: vi.fn(),
        onClickElement: vi.fn(),
        onInputText: vi.fn()
      })
    );

    expect(topBar).toContain('title="添加终端"');
    expect(topBar).toContain('title="命令面板"');
    expect(topBar).toContain('title="快速添加"');
    expect(englishTopBar).toContain('title="Add terminal"');
    expect(englishTopBar).toContain('title="Command menu"');
    expect(englishTopBar).toContain('title="Quick add"');
    expect(portalToolbar).toContain('Open page');
    expect(portalToolbar).toContain('Capture screenshot');
    expect(portalToolbar).toContain('Read structure');
    expect(portalToolbar).toContain('portal-url-input-portal-1');
  });

  it('renders workspace-and-resource context alongside git summaries', () => {
    const contextPanel = renderToStaticMarkup(
      createElement(
        I18nProvider,
        null,
        createElement(
          WorkbenchContextPanel,
          {
            workspaceName: 'Alpha Workspace'
          },
          createElement('div', null, 'workspace list')
        )
      )
    );
    const html = renderToStaticMarkup(
      createElement(GitPanel, {
        nodeId: 'git-1',
        isGitRepo: true,
        readOnly: true,
        summary: {
          modified: 1,
          added: 2,
          deleted: 0,
          renamed: 0,
          copied: 0,
          unmerged: 0,
          untracked: 3,
          ignored: 0
        },
        onCreateBranchWorkspace: vi.fn(),
        canCreateBranchWorkspace: false
      })
    );

    expect(contextPanel).toContain('workspace list');
    expect(contextPanel).not.toContain('工作区注册表');
    expect(contextPanel).not.toContain('上下文与资源');
    expect(contextPanel).not.toContain('data-testid="workbench-resource-starters"');
    expect(html).toContain('Modified: 1');
    expect(html).toContain('Added: 2');
    expect(html).toContain('Untracked: 3');
    expect(html).toContain('Read-only repo surface');
    expect(html).toContain('Branch workspace');
    expect(html).toContain('disabled=""');
  });
});
