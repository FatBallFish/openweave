import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CreateWorkspaceDialog } from '../../src/renderer/features/workspaces/CreateWorkspaceDialog';

describe('CreateWorkspaceDialog', () => {
  it('does not prefill a potentially invalid root directory', () => {
    const html = renderToStaticMarkup(
      createElement(CreateWorkspaceDialog, {
        open: true,
        loading: false,
        groups: [],
        onCancel: () => {},
        onCreate: async () => {}
      })
    );

    expect(html).toContain('data-testid="create-workspace-root-input"');
    expect(html).toContain('value=""');
    expect(html).not.toContain('/tmp/openweave-demo');
  });

  it('renders group select when open', () => {
    const html = renderToStaticMarkup(
      createElement(CreateWorkspaceDialog, {
        open: true,
        loading: false,
        groups: [],
        onCancel: () => {},
        onCreate: async () => {}
      })
    );

    expect(html).toContain('data-testid="create-workspace-group-select"');
  });

  it('contains "未分组"/"Ungrouped" option', () => {
    const html = renderToStaticMarkup(
      createElement(CreateWorkspaceDialog, {
        open: true,
        loading: false,
        groups: [],
        onCancel: () => {},
        onCreate: async () => {}
      })
    );

    expect(html).toContain('value=""');
  });

  it('contains options for provided groups', () => {
    const html = renderToStaticMarkup(
      createElement(CreateWorkspaceDialog, {
        open: true,
        loading: false,
        groups: [
          { id: 'g1', name: 'Group A', sortOrder: 0, createdAtMs: 0, updatedAtMs: 0 },
          { id: 'g2', name: 'Group B', sortOrder: 1, createdAtMs: 0, updatedAtMs: 0 }
        ],
        onCancel: () => {},
        onCreate: async () => {}
      })
    );

    expect(html).toContain('value="g1"');
    expect(html).toContain('Group A');
    expect(html).toContain('value="g2"');
    expect(html).toContain('Group B');
  });
});
