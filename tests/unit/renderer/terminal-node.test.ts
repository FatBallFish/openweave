// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TerminalNode } from '../../../src/renderer/features/canvas/nodes/TerminalNode';

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
  Terminal: vi.fn().mockImplementation(() => {
    const instance = {
      open: vi.fn(),
      write: vi.fn(),
      clear: vi.fn(),
      dispose: vi.fn(),
      onData: vi.fn(),
      focus: vi.fn(),
      loadAddon: vi.fn(),
      options: {},
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

describe('TerminalNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    terminalInstances.length = 0;
    vi.useFakeTimers();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn()
    }));
    (globalThis as any).window = {
      openweaveShell: {
        runs: {
          listRuns: vi.fn().mockResolvedValue({ runs: [] }),
          startRun: vi.fn().mockResolvedValue({
            run: {
              id: 'run-1',
              workspaceId: 'ws-1',
              nodeId: 't1',
              runtime: 'claude',
              command: '',
              status: 'queued',
              summary: null,
              tailLog: '',
              createdAtMs: Date.now(),
              startedAtMs: null,
              completedAtMs: null
            }
          }),
          inputRun: vi.fn(),
          resizeRun: vi.fn(),
          subscribeStream: vi.fn(),
          unsubscribeStream: vi.fn(),
          onStream: vi.fn().mockReturnValue(() => {})
        }
      }
    };
  });

  it('renders xterm container', () => {
    const html = renderToStaticMarkup(
      createElement(TerminalNode, {
        workspaceId: 'ws-1',
        node: { id: 't1', type: 'terminal', x: 0, y: 0, command: 'echo hi', runtime: 'shell' },
        config: { workingDir: '', iconKey: '', iconColor: '', theme: 'auto', fontFamily: '', fontSize: 14, roleId: null },
        onChange: () => {},
        onOpenRun: () => {}
      })
    );
    expect(html).toContain('terminal-node-xterm-t1');
  });

  it('auto-starts managed runtimes even when the initial command is empty', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const shell = (globalThis as any).window.openweaveShell;

    await act(async () => {
      root.render(
        createElement(TerminalNode, {
          workspaceId: 'ws-1',
          node: { id: 't1', type: 'terminal', x: 0, y: 0, command: '', runtime: 'claude' },
          config: {
            workingDir: '',
            iconKey: '',
            iconColor: '',
            theme: 'auto',
            fontFamily: '',
            fontSize: 14,
            roleId: null
          },
          onChange: () => {},
          onOpenRun: () => {}
        })
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(650);
      await Promise.resolve();
    });

    expect(shell.runs.startRun).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      nodeId: 't1',
      runtime: 'claude',
      command: ''
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('backfills missed startup output from the polled tail log only once per run', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const shell = (globalThis as any).window.openweaveShell;

    shell.runs.listRuns = vi
      .fn()
      .mockResolvedValueOnce({
        runs: [
          {
            id: 'run-1',
            workspaceId: 'ws-1',
            nodeId: 't1',
            runtime: 'shell',
            command: '',
            status: 'running',
            summary: null,
            tailLog: 'prompt> ',
            createdAtMs: Date.now(),
            startedAtMs: Date.now(),
            completedAtMs: null
          }
        ]
      })
      .mockResolvedValue({
        runs: [
          {
            id: 'run-1',
            workspaceId: 'ws-1',
            nodeId: 't1',
            runtime: 'codex',
            command: '',
            status: 'running',
            summary: null,
            tailLog: 'prompt> \u001b[2J',
            createdAtMs: Date.now(),
            startedAtMs: Date.now(),
            completedAtMs: null
          }
        ]
      });

    await act(async () => {
      root.render(
        createElement(TerminalNode, {
          workspaceId: 'ws-1',
          node: { id: 't1', type: 'terminal', x: 0, y: 0, command: '', runtime: 'shell' },
          config: {
            workingDir: '',
            iconKey: '',
            iconColor: '',
            theme: 'auto',
            fontFamily: '',
            fontSize: 14,
            roleId: null
          },
          onChange: () => {},
          onOpenRun: () => {}
        })
      );
      await Promise.resolve();
    });

    expect(terminalInstances[0]?.write).toHaveBeenCalledWith('prompt> ');

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(terminalInstances[0]?.write).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
