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
        onCancel: () => {},
        onCreate: async () => {}
      })
    );

    expect(html).toContain('data-testid="create-workspace-root-input"');
    expect(html).toContain('value=""');
    expect(html).not.toContain('/tmp/openweave-demo');
  });
});
