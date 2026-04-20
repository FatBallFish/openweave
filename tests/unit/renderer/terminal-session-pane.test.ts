import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TerminalSessionPane } from '../../../src/renderer/features/runs/TerminalSessionPane';

describe('terminal session pane', () => {
  it('renders interactive controls for an active run', () => {
    const html = renderToStaticMarkup(
      createElement(TerminalSessionPane, {
        run: {
          id: 'run-active',
          workspaceId: 'ws-1',
          nodeId: 'terminal-1',
          runtime: 'shell',
          command: 'cat',
          status: 'running',
          summary: null,
          tailLog: 'hello\n',
          createdAtMs: 1,
          startedAtMs: 2,
          completedAtMs: null
        },
        inputValue: 'follow-up\n',
        inputErrorMessage: null,
        isSubmittingInput: false,
        isStopping: false,
        onInputChange: vi.fn(),
        onSubmitInput: vi.fn(),
        onStop: vi.fn()
      })
    );

    expect(html).toContain('terminal-session-pane');
    expect(html).toContain('terminal-session-toolbar');
    expect(html).toContain('terminal-session-output');
    expect(html).toContain('terminal-session-input');
    expect(html).toContain('terminal-session-send');
    expect(html).toContain('terminal-session-stop');
    expect(html).toContain('Session active');
  });

  it('treats stopped as a terminal renderer state', () => {
    const html = renderToStaticMarkup(
      createElement(TerminalSessionPane, {
        run: {
          id: 'run-stopped',
          workspaceId: 'ws-1',
          nodeId: 'terminal-1',
          runtime: 'shell',
          command: 'cat',
          status: 'stopped',
          summary: 'Run stopped',
          tailLog: 'bye\n',
          createdAtMs: 1,
          startedAtMs: 2,
          completedAtMs: 3
        },
        inputValue: '',
        inputErrorMessage: null,
        isSubmittingInput: false,
        isStopping: false,
        onInputChange: vi.fn(),
        onSubmitInput: vi.fn(),
        onStop: vi.fn()
      })
    );

    expect(html).toContain('Session stopped');
    expect(html).toContain('disabled=""');
  });
});
