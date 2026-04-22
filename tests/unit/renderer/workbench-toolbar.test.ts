import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WorkbenchTopBar } from '../../../src/renderer/features/workbench/WorkbenchTopBar';

describe('workbench top bar', () => {
  it('puts orchestration actions before global management actions', () => {
    const html = renderToStaticMarkup(
      createElement(WorkbenchTopBar, {
        disabled: false,
        commandMenuDisabled: false,
        quickAddDisabled: false,
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
        onToggleInspector: vi.fn(),
        activePlacementType: null,
        onTogglePlacement: vi.fn()
      })
    );

    const createClusterIndex = html.indexOf('data-testid="workbench-topbar-create-cluster"');
    const addTerminalIndex = html.indexOf('data-testid="workbench-topbar-action-add-terminal"');
    const addTextIndex = html.indexOf('data-testid="workbench-topbar-action-add-text"');

    expect(createClusterIndex).toBeGreaterThan(-1);
    expect(addTerminalIndex).toBeGreaterThan(-1);
    expect(addTextIndex).toBeGreaterThan(addTerminalIndex);
    expect(html).toContain('class="ow-icon-button ow-icon-button--primary"');
    expect(html).toContain('title="添加终端"');
    expect(html).not.toContain('title="命令面板"');
    expect(html).not.toContain('title="快速添加"');
    expect(html).not.toContain('title="切换检查器"');
    expect(html).not.toContain('workbench-topbar__identity');
    expect(html).not.toContain('>Add terminal<');
    expect(html).not.toContain('OpenWeave');
  });
});
