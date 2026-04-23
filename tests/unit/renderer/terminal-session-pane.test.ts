// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TerminalSessionPane } from '../../../src/renderer/features/runs/TerminalSessionPane';

let streamHandler:
  | ((event: { runId: string; chunk: string; chunkStartOffset: number; chunkEndOffset: number }) => void)
  | null = null;

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

const createRun = (overrides: Record<string, unknown> = {}) => ({
  id: 'r1',
  workspaceId: 'ws1',
  nodeId: 'n1',
  runtime: 'shell',
  command: '',
  status: 'running',
  summary: null,
  tailLog: '',
  tailStartOffset: 0,
  tailEndOffset: 0,
  createdAtMs: 1,
  startedAtMs: 1,
  completedAtMs: null,
  ...overrides
});

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
          onStream: vi.fn(
            (handler: (event: { runId: string; chunk: string; chunkStartOffset: number; chunkEndOffset: number }) => void) => {
              streamHandler = handler;
              return () => {
                streamHandler = null;
              };
            }
          )
        }
      }
    };
  });

  it('renders xterm container', () => {
    const html = renderToStaticMarkup(
      createElement(TerminalSessionPane, {
        run: createRun({ command: 'echo hi' }),
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
          run: createRun(),
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
          run: createRun(),
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

  it('catches up missed active output from offset snapshots without replaying gap chunks', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(TerminalSessionPane, {
          run: createRun(),
          isStopping: false,
          onStop: () => {}
        })
      );
    });

    terminalInstances[0]?.write.mockClear();

    await act(async () => {
      streamHandler?.({ runId: 'r1', chunk: 'typed', chunkStartOffset: 8, chunkEndOffset: 13 });
      await Promise.resolve();
    });

    expect(terminalInstances[0]?.write).not.toHaveBeenCalled();

    await act(async () => {
      root.render(
        createElement(TerminalSessionPane, {
          run: createRun({
            tailLog: 'prompt> typed',
            tailStartOffset: 0,
            tailEndOffset: 13
          }),
          isStopping: false,
          onStop: () => {}
        })
      );
      await Promise.resolve();
    });

    expect(terminalInstances[0]?.write.mock.calls.map((call) => call[0])).toEqual(['prompt> typed']);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('redraws active output when a newer snapshot no longer covers the rendered range', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(TerminalSessionPane, {
          run: createRun({
            tailLog: 'prompt> old',
            tailStartOffset: 0,
            tailEndOffset: 11
          }),
          isStopping: false,
          onStop: () => {}
        })
      );
    });

    terminalInstances[0]?.clear.mockClear();
    terminalInstances[0]?.write.mockClear();

    await act(async () => {
      root.render(
        createElement(TerminalSessionPane, {
          run: createRun({
            tailLog: 'next tail',
            tailStartOffset: 50,
            tailEndOffset: 59
          }),
          isStopping: false,
          onStop: () => {}
        })
      );
      await Promise.resolve();
    });

    expect(terminalInstances[0]?.clear).toHaveBeenCalledTimes(1);
    expect(terminalInstances[0]?.write).toHaveBeenCalledWith('next tail');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('redraws instead of appending when active snapshot catch-up starts inside an ANSI sequence', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const fullScreenClear = 'prompt> \u001b[2J\u001b[Hpanel';
    const partialOutput = fullScreenClear.slice(0, 10);

    await act(async () => {
      root.render(
        createElement(TerminalSessionPane, {
          run: createRun({
            runtime: 'codex'
          }),
          isStopping: false,
          onStop: () => {}
        })
      );
    });

    terminalInstances[0]?.write.mockClear();
    terminalInstances[0]?.clear.mockClear();

    await act(async () => {
      streamHandler?.({
        runId: 'r1',
        chunk: partialOutput,
        chunkStartOffset: 0,
        chunkEndOffset: partialOutput.length
      });
      await Promise.resolve();
    });

    expect(terminalInstances[0]?.write).toHaveBeenCalledWith(partialOutput);

    terminalInstances[0]?.write.mockClear();

    await act(async () => {
      root.render(
        createElement(TerminalSessionPane, {
          run: createRun({
            runtime: 'codex',
            tailLog: fullScreenClear,
            tailStartOffset: 0,
            tailEndOffset: fullScreenClear.length
          }),
          isStopping: false,
          onStop: () => {}
        })
      );
      await Promise.resolve();
    });

    expect(terminalInstances[0]?.clear).toHaveBeenCalledTimes(1);
    expect(terminalInstances[0]?.write.mock.calls.map((call) => call[0])).toEqual([fullScreenClear]);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
