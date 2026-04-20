import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WorkbenchTopBar } from '../../../src/renderer/features/workbench/WorkbenchTopBar';

describe('workbench top bar', () => {
  it('puts orchestration actions before global management actions', () => {
    const html = renderToStaticMarkup(
      createElement(WorkbenchTopBar, {
        workspaceName: 'Alpha Workspace',
        disabled: false,
        commandMenuDisabled: true,
        fitViewDisabled: true,
        onAddTerminal: vi.fn(),
        onAddNote: vi.fn(),
        onAddPortal: vi.fn(),
        onAddFileTree: vi.fn(),
        onAddText: vi.fn(),
        onOpenCommandMenu: vi.fn(),
        onFitCanvas: vi.fn(),
        onOpenSettings: vi.fn(),
        settingsDisabled: true
      })
    );

    const addTerminalIndex = html.indexOf('Add terminal');
    const addTextIndex = html.indexOf('Add text');
    const commandPaletteIndex = html.indexOf('Command menu');
    const settingsIndex = html.indexOf('Settings');

    expect(addTerminalIndex).toBeGreaterThan(-1);
    expect(addTextIndex).toBeGreaterThan(addTerminalIndex);
    expect(commandPaletteIndex).toBeGreaterThan(addTextIndex);
    expect(settingsIndex).toBeGreaterThan(commandPaletteIndex);
  });
});
