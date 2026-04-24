// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CommandPalette } from '../../../src/renderer/features/workbench/CommandPalette';
import { getCanvasShortcutAction } from '../../../src/renderer/features/canvas-shell/useCanvasShortcuts';

describe('command palette', () => {
  it('renders orchestration commands and quick-add groups', () => {
    const html = renderToStaticMarkup(
      createElement(CommandPalette, {
        mode: 'quick-add',
        open: true,
        onClose: vi.fn(),
        items: [
          { id: 'terminal', label: 'Add terminal', hint: '1', section: 'Create', onSelect: vi.fn() },
          { id: 'note', label: 'Add note', hint: '2', section: 'Create', onSelect: vi.fn() }
        ]
      })
    );

    expect(html).toContain('command-palette');
    expect(html).toContain('command-palette-trigger');
    expect(html).toContain('快速添加');
    expect(html).toContain('Add terminal');
    expect(html).toContain('Add note');
  });

  it('maps primary workflow shortcuts into semantic actions', () => {
    expect(
      getCanvasShortcutAction({
        key: 'k',
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        target: null
      })
    ).toBe('open-command-palette');
    expect(
      getCanvasShortcutAction({
        key: '/',
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        target: null
      })
    ).toBe('open-quick-add');
    expect(
      getCanvasShortcutAction({
        key: 'I',
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
        altKey: false,
        target: null
      })
    ).toBe('toggle-inspector');
    expect(
      getCanvasShortcutAction({
        key: '3',
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        target: null
      })
    ).toBe('add-portal');
  });
});
