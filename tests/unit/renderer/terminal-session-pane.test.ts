// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TerminalSessionPane } from '../../../src/renderer/features/runs/TerminalSessionPane';

let streamHandler: ((event: { runId: string; chunk: string }) => void) | null = null;

const terminalInstances: Array<{
  open: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  onData: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
  loadAddon: ReturnType<typeof vi.fn>;
  options: Record<string, unknown>;
  cols: number;
  rows: number;
}> = [];

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation((options: Record<string, unknown> = {}) => {
    const instance = {
      open: vi.fn(),
      write: vi.fn(),
      clear: vi.fn(),
      dispose: vi.fn(),
      onData: vi.fn(),
      focus: vi.fn(),
      loadAddon: vi.fn(),
      options,
      cols: 80,
      rows: 24
    };
    terminalInstances.push(instance);
    return instance;
  })
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn()
  }))
}));

describe('TerminalSessionPane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    terminalInstances.length = 0;
    streamHandler = null;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn()
    }));
    (globalThis as any).window = {
      openweaveShell: {
        runs: {
          subscribeStream: vi.fn(),
          unsubscribeStream: vi.fn(),
          onStream: vi.fn((handler: (event: { runId: string; chunk: string }) => void) => {
            streamHandler = handler;
            return () => {
              streamHandler = null;
            };
          })
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
        isStopping: false,
        onStop: () => {}
      })
    );
    expect(html).toContain('terminal-session-xterm');
  });

  it('preserves raw PTY line endings when booting xterm', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(TerminalSessionPane, {
          run: {
            id: 'r1',
            workspaceId: 'ws1',
            nodeId: 'n1',
            runtime: 'shell',
            command: '',
            status: 'running',
            summary: null,
            tailLog: '',
            createdAtMs: Date.now(),
            startedAtMs: Date.now(),
            completedAtMs: null
          },
          isStopping: false,
          onStop: () => {}
        })
      );
    });

    expect(terminalInstances[0]?.options).toMatchObject({
      convertEol: false
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('refocuses the xterm when the session surface is clicked', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(TerminalSessionPane, {
          run: {
            id: 'r1',
            workspaceId: 'ws1',
            nodeId: 'n1',
            runtime: 'shell',
            command: '',
            status: 'running',
            summary: null,
            tailLog: '',
            createdAtMs: Date.now(),
            startedAtMs: Date.now(),
            completedAtMs: null
          },
          isStopping: false,
          onStop: () => {}
        })
      );
    });

    const terminal = terminalInstances[0];
    expect(terminal?.focus).toHaveBeenCalledTimes(1);

    const surface = container.querySelector('[data-testid="terminal-session-xterm"]');
    expect(surface).not.toBeNull();
    surface?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    surface?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(terminal?.focus).toHaveBeenCalledTimes(3);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('backfills tail output that arrived before stream subscription only on first paint', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(TerminalSessionPane, {
          run: {
            id: 'r1',
            workspaceId: 'ws1',
            nodeId: 'n1',
            runtime: 'shell',
            command: '',
            status: 'running',
            summary: null,
            tailLog: 'prompt> ',
            createdAtMs: Date.now(),
            startedAtMs: Date.now(),
            completedAtMs: null
          },
          isStopping: false,
          onStop: () => {}
        })
      );
    });

    expect(terminalInstances[0]?.write).toHaveBeenCalledWith('prompt> ');

    await act(async () => {
      root.render(
        createElement(TerminalSessionPane, {
          run: {
            id: 'r1',
            workspaceId: 'ws1',
            nodeId: 'n1',
            runtime: 'codex',
            command: '',
            status: 'running',
            summary: null,
            tailLog: 'prompt> \u001b[2J',
            createdAtMs: Date.now(),
            startedAtMs: Date.now(),
            completedAtMs: null
          },
          isStopping: false,
          onStop: () => {}
        })
      );
    });

    expect(terminalInstances[0]?.write).toHaveBeenCalledTimes(1);

    await act(async () => {
      streamHandler?.({ runId: 'r1', chunk: 'typed' });
      await Promise.resolve();
    });

    terminalInstances[0]?.write.mockClear();

    await act(async () => {
      root.render(
        createElement(TerminalSessionPane, {
          run: {
            id: 'r1',
            workspaceId: 'ws1',
            nodeId: 'n1',
            runtime: 'codex',
            command: '',
            status: 'running',
            summary: null,
            tailLog: 'prompt> typed\u001b[2K\rprompt> typed',
            createdAtMs: Date.now(),
            startedAtMs: Date.now(),
            completedAtMs: null
          },
          isStopping: false,
          onStop: () => {}
        })
      );
      await Promise.resolve();
    });

    expect(terminalInstances[0]?.write).not.toHaveBeenCalled();

    await act(async () => {
      root.render(
        createElement(TerminalSessionPane, {
          run: {
            id: 'r1',
            workspaceId: 'ws1',
            nodeId: 'n1',
            runtime: 'codex',
            command: '',
            status: 'completed',
            summary: 'done',
            tailLog: 'prompt> final\r\n',
            createdAtMs: Date.now(),
            startedAtMs: Date.now(),
            completedAtMs: Date.now()
          },
          isStopping: false,
          onStop: () => {}
        })
      );
      await Promise.resolve();
    });

    expect(terminalInstances[0]?.clear).toHaveBeenCalledTimes(2);
    expect(terminalInstances[0]?.write).toHaveBeenCalledWith('prompt> final\r\n');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
