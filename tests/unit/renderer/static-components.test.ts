import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BranchWorkspaceDialog } from '../../../src/renderer/features/workspaces/BranchWorkspaceDialog';
import { NodeToolbar } from '../../../src/renderer/features/canvas/nodes/NodeToolbar';
import { PortalToolbar } from '../../../src/renderer/features/portal/PortalToolbar';
import { GitPanel } from '../../../src/renderer/features/git/GitPanel';

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

  it('renders the node and portal toolbars with their actions', () => {
    const nodeToolbar = renderToStaticMarkup(
      createElement(NodeToolbar, {
        disabled: true,
        onAddNote: vi.fn(),
        onAddTerminal: vi.fn(),
        onAddFileTree: vi.fn(),
        onAddPortal: vi.fn()
      })
    );
    const portalToolbar = renderToStaticMarkup(
      createElement(PortalToolbar, {
        nodeId: 'portal-1',
        disabled: false,
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

    expect(nodeToolbar).toContain('canvas-add-note');
    expect(nodeToolbar).toContain('disabled=""');
    expect(portalToolbar).toContain('Capture screenshot');
    expect(portalToolbar).toContain('Read structure');
    expect(portalToolbar).toContain('portal-url-input-portal-1');
  });

  it('renders git summaries for clean, readonly, and branch-action states', () => {
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

    expect(html).toContain('Modified: 1');
    expect(html).toContain('Added: 2');
    expect(html).toContain('Untracked: 3');
    expect(html).toContain('Read-only mode');
    expect(html).toContain('Create branch workspace');
    expect(html).toContain('disabled=""');
  });
});
