// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TerminalNode } from '../../../src/renderer/features/canvas/nodes/TerminalNode';

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
  dataHandlers: Array<(data: string) => void>;
  rootElement: HTMLDivElement;
  options: Record<string, unknown>;
  cols: number;
  rows: number;
}> = [];

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation((options: Record<string, unknown> = {}) => {
    const dataHandlers: Array<(data: string) => void> = [];
    const rootElement = document.createElement('div');
    rootElement.className = 'xterm';
    const helperTextarea = document.createElement('textarea');
    helperTextarea.className = 'xterm-helper-textarea';
    const screenElement = document.createElement('div');
    screenElement.className = 'xterm-screen';
    screenElement.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });
    rootElement.appendChild(helperTextarea);
    rootElement.appendChild(screenElement);
    const instance = {
      open: vi.fn((container: HTMLElement) => {
        container.appendChild(rootElement);
      }),
      write: vi.fn(),
      clear: vi.fn(),
      dispose: vi.fn(),
      onData: vi.fn((handler: (data: string) => void) => {
        dataHandlers.push(handler);
        return { dispose: vi.fn() };
      }),
      focus: vi.fn(() => {
        helperTextarea.focus();
      }),
      loadAddon: vi.fn(),
      dataHandlers,
      rootElement,
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
  id: 'run-1',
  workspaceId: 'ws-1',
  nodeId: 't1',
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

describe('TerminalNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    terminalInstances.length = 0;
    streamHandler = null;
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

  it('preserves raw PTY line endings when booting xterm', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

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
    });

    expect(terminalInstances[0]?.options).toMatchObject({
      convertEol: false
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
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
      command: '',
      workingDir: ''
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('waits for role working directory hydration before auto-starting a new terminal', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const shell = (globalThis as any).window.openweaveShell;
    const projectDir = '/tmp/project-root';
    const roleDir = '/tmp/project-root/.openweave/roles/t1';

    await act(async () => {
      root.render(
        createElement(TerminalNode, {
          workspaceId: 'ws-1',
          node: { id: 't1', type: 'terminal', x: 0, y: 0, command: '', runtime: 'claude' },
          config: {
            workingDir: projectDir,
            projectDir: null,
            iconKey: '',
            iconColor: '',
            theme: 'auto',
            fontFamily: '',
            fontSize: 14,
            roleId: 'role-1'
          },
          onChange: () => {},
          onOpenRun: () => {}
        })
      );
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(650);
      await Promise.resolve();
    });

    expect(shell.runs.startRun).not.toHaveBeenCalled();

    await act(async () => {
      root.render(
        createElement(TerminalNode, {
          workspaceId: 'ws-1',
          node: { id: 't1', type: 'terminal', x: 0, y: 0, command: '', runtime: 'claude' },
          config: {
            workingDir: roleDir,
            projectDir,
            iconKey: '',
            iconColor: '',
            theme: 'auto',
            fontFamily: '',
            fontSize: 14,
            roleId: 'role-1'
          },
          onChange: () => {},
          onOpenRun: () => {}
        })
      );
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(650);
      await Promise.resolve();
    });

    expect(shell.runs.startRun).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      nodeId: 't1',
      runtime: 'claude',
      command: '',
      workingDir: roleDir
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('appends the missing suffix from an active snapshot when offsets advance', async () => {
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
            tailStartOffset: 0,
            tailEndOffset: 8,
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
            tailStartOffset: 0,
            tailEndOffset: 12,
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

    expect(terminalInstances[0]?.write).toHaveBeenCalledTimes(2);
    expect(terminalInstances[0]?.write).toHaveBeenLastCalledWith('\u001b[2J');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('repairs an active run from the polled snapshot when offsets prove bytes are missing', async () => {
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
            tailStartOffset: 0,
            tailEndOffset: 8,
            createdAtMs: Date.now(),
            startedAtMs: Date.now(),
            completedAtMs: null
          }
        ]
      })
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
            tailLog: 'prompt> hello\r\n',
            tailStartOffset: 0,
            tailEndOffset: 15,
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
            runtime: 'shell',
            command: '',
            status: 'running',
            summary: null,
            tailLog: 'prompt> hello\r\n',
            tailStartOffset: 0,
            tailEndOffset: 15,
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

    expect(terminalInstances[0]?.write).toHaveBeenCalledTimes(2);
    expect(terminalInstances[0]?.write).toHaveBeenLastCalledWith('hello\r\n');
    expect(terminalInstances[0]?.clear).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('refreshes terminal history from tail log after the run becomes terminal', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

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

    const shell = (globalThis as any).window.openweaveShell;
    shell.runs.listRuns = vi.fn().mockResolvedValue({
      runs: [
        {
          id: 'run-1',
          workspaceId: 'ws-1',
          nodeId: 't1',
          runtime: 'shell',
          command: '',
          status: 'completed',
          summary: 'done',
          tailLog: 'prompt> final\r\n',
          createdAtMs: Date.now(),
          startedAtMs: Date.now(),
          completedAtMs: Date.now()
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
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(terminalInstances[0]?.clear).toHaveBeenCalledTimes(1);
    expect(terminalInstances[0]?.write).toHaveBeenCalledWith('prompt> final\r\n');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('does not replay polled bytes after live stream output has already advanced the offset', async () => {
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
            runtime: 'codex',
            command: '',
            status: 'running',
            summary: null,
            tailLog: 'prompt> ',
            tailStartOffset: 0,
            tailEndOffset: 8,
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
            tailLog: 'prompt> typed',
            tailStartOffset: 0,
            tailEndOffset: 13,
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
          node: { id: 't1', type: 'terminal', x: 0, y: 0, command: '', runtime: 'codex' },
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

    terminalInstances[0]?.write.mockClear();

    await act(async () => {
      streamHandler?.({ runId: 'run-1', chunk: 'typed', chunkStartOffset: 8, chunkEndOffset: 13 });
      await Promise.resolve();
    });

    expect(terminalInstances[0]?.write).toHaveBeenCalledTimes(1);
    expect(terminalInstances[0]?.write).toHaveBeenLastCalledWith('typed');

    terminalInstances[0]?.write.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(terminalInstances[0]?.write).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('auto-starts a fresh run when only terminal history exists', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const shell = (globalThis as any).window.openweaveShell;

    shell.runs.listRuns = vi.fn().mockResolvedValue({
      runs: [
        {
          id: 'run-old',
          workspaceId: 'ws-1',
          nodeId: 't1',
          runtime: 'shell',
          command: '',
          status: 'failed',
          summary: 'Recovered after unclean shutdown',
          tailLog: 'prompt> old\n',
          createdAtMs: Date.now() - 1000,
          startedAtMs: Date.now() - 1000,
          completedAtMs: Date.now() - 500
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

    expect(terminalInstances[0]?.write).toHaveBeenCalledWith('prompt> old\n');

    await act(async () => {
      vi.advanceTimersByTime(650);
      await Promise.resolve();
    });

    expect(shell.runs.startRun).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      nodeId: 't1',
      runtime: 'shell',
      command: '',
      workingDir: ''
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('routes input from multiple terminal instances to their own active runs', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const shell = (globalThis as any).window.openweaveShell;

    shell.runs.listRuns = vi.fn(({ nodeId }: { nodeId: string }) =>
      Promise.resolve({
        runs: [
          {
            id: `run-${nodeId}`,
            workspaceId: 'ws-1',
            nodeId,
            runtime: 'codex',
            command: '',
            status: 'running',
            summary: null,
            tailLog: '',
            createdAtMs: Date.now(),
            startedAtMs: Date.now(),
            completedAtMs: null
          }
        ]
      })
    );

    await act(async () => {
      root.render(
        createElement(
          'div',
          null,
          createElement(TerminalNode, {
            workspaceId: 'ws-1',
            node: { id: 't1', type: 'terminal', x: 0, y: 0, command: '', runtime: 'codex' },
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
          }),
          createElement(TerminalNode, {
            workspaceId: 'ws-1',
            node: { id: 't2', type: 'terminal', x: 0, y: 0, command: '', runtime: 'codex' },
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
        )
      );
      await Promise.resolve();
    });

    terminalInstances[0]?.dataHandlers[0]?.('first');
    terminalInstances[1]?.dataHandlers[0]?.('second');

    expect(shell.runs.inputRun).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      runId: 'run-t1',
      input: 'first'
    });
    expect(shell.runs.inputRun).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      runId: 'run-t2',
      input: 'second'
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('focuses a terminal from xterm internals even when child pointer events stop bubbling', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

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

    terminalInstances[0]?.focus.mockClear();
    terminalInstances[0]?.rootElement
      .querySelector('.xterm-screen')
      ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));

    expect(terminalInstances[0]?.focus).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(
      terminalInstances[0]?.rootElement.querySelector('.xterm-helper-textarea')
    );

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('keeps focused terminal wheel events from bubbling to the canvas', async () => {
    const container = document.createElement('div');
    const canvasWheel = vi.fn();
    container.addEventListener('wheel', canvasWheel);
    document.body.appendChild(container);
    const root = createRoot(container);

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

    const terminal = container.querySelector('[data-testid="terminal-node-xterm-t1"]') as HTMLDivElement;
    terminalInstances[0]?.focus();
    terminal.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 8 }));

    expect(canvasWheel).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('catches up missed active output from later snapshots without replaying gap chunks', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const shell = (globalThis as any).window.openweaveShell;

    shell.runs.listRuns = vi
      .fn()
      .mockResolvedValueOnce({
        runs: [createRun()]
      })
      .mockResolvedValue({
        runs: [
          createRun({
            tailLog: 'prompt> typed',
            tailStartOffset: 0,
            tailEndOffset: 13
          })
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

    terminalInstances[0]?.write.mockClear();

    await act(async () => {
      streamHandler?.({ runId: 'run-1', chunk: 'typed', chunkStartOffset: 8, chunkEndOffset: 13 });
      await Promise.resolve();
    });

    expect(terminalInstances[0]?.write).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(terminalInstances[0]?.write.mock.calls.map((call) => call[0])).toEqual(['prompt> typed']);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('redraws active output when the polled snapshot skips past the rendered range', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const shell = (globalThis as any).window.openweaveShell;

    shell.runs.listRuns = vi
      .fn()
      .mockResolvedValueOnce({
        runs: [
          createRun({
            tailLog: 'prompt> old',
            tailStartOffset: 0,
            tailEndOffset: 11
          })
        ]
      })
      .mockResolvedValue({
        runs: [
          createRun({
            tailLog: 'next tail',
            tailStartOffset: 50,
            tailEndOffset: 59
          })
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

    terminalInstances[0]?.clear.mockClear();
    terminalInstances[0]?.write.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(500);
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
    const shell = (globalThis as any).window.openweaveShell;
    const fullScreenClear = 'prompt> \u001b[2J\u001b[Hpanel';
    const partialOutput = fullScreenClear.slice(0, 10);

    shell.runs.listRuns = vi
      .fn()
      .mockResolvedValueOnce({
        runs: [createRun()]
      })
      .mockResolvedValue({
        runs: [
          createRun({
            runtime: 'codex',
            tailLog: fullScreenClear,
            tailStartOffset: 0,
            tailEndOffset: fullScreenClear.length
          })
        ]
      });

    await act(async () => {
      root.render(
        createElement(TerminalNode, {
          workspaceId: 'ws-1',
          node: { id: 't1', type: 'terminal', x: 0, y: 0, command: '', runtime: 'codex' },
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

    terminalInstances[0]?.write.mockClear();
    terminalInstances[0]?.clear.mockClear();

    await act(async () => {
      streamHandler?.({
        runId: 'run-1',
        chunk: partialOutput,
        chunkStartOffset: 0,
        chunkEndOffset: partialOutput.length
      });
      await Promise.resolve();
    });

    expect(terminalInstances[0]?.write).toHaveBeenCalledWith(partialOutput);

    terminalInstances[0]?.write.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(500);
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
