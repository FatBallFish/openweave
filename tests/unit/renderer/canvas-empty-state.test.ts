// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CanvasEmptyState } from '../../../src/renderer/features/canvas-shell/CanvasEmptyState';

describe('canvas empty state', () => {
  it('renders a lightweight orchestration-first empty state', () => {
    const html = renderToStaticMarkup(
      createElement(CanvasEmptyState, {
        actions: [
          { label: 'Terminal', hotkey: '1', onClick: () => undefined },
          { label: 'Note', hotkey: '2', onClick: () => undefined },
          { label: 'Portal', hotkey: '3', onClick: () => undefined },
          { label: 'File tree', hotkey: '4', onClick: () => undefined },
          { label: 'Text', hotkey: '5', onClick: () => undefined }
        ]
      })
    );

    expect(html).toContain('canvas-empty-state');
    expect(html).toContain('从终端开始');
    expect(html).toContain('调试仓库');
    expect(html).toContain('探索网站');
    expect(html).toContain('canvas-empty-action-terminal');
    expect(html).toContain('canvas-empty-action-file-tree');
  });
});
