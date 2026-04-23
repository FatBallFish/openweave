// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TerminalSessionPane } from '../../../src/renderer/features/runs/TerminalSessionPane';

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    write: vi.fn(),
    dispose: vi.fn(),
    onData: vi.fn(),
    options: {},
    cols: 80,
    rows: 24
  }))
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn()
  }))
}));

describe('TerminalSessionPane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn()
    }));
    (globalThis as any).window = {
      openweaveShell: {
        runs: {
          subscribeStream: vi.fn(),
          unsubscribeStream: vi.fn(),
          onStream: vi.fn().mockReturnValue(() => {})
        }
      }
    };
  });

  it('renders xterm container', () => {
    const html = renderToStaticMarkup(
      createElement(TerminalSessionPane, {
        run: {
          id: 'r1',
          workspaceId: 'ws1',
          nodeId: 'n1',
          runtime: 'shell',
          command: 'echo hi',
          status: 'running',
          summary: null,
          tailLog: '',
          createdAtMs: Date.now(),
          startedAtMs: Date.now(),
          completedAtMs: null
        },
        inputValue: '',
        inputErrorMessage: null,
        isSubmittingInput: false,
        isStopping: false,
        onInputChange: () => {},
        onSubmitInput: () => {},
        onStop: () => {}
      })
    );
    expect(html).toContain('terminal-session-xterm');
  });
});
