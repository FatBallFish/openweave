import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { OpenWeaveShellBridge, RunRecord } from '../../../../shared/ipc/contracts';
import type { RunRuntimeInput, TerminalNodeInput } from '../../../../shared/ipc/schemas';
import { getXtermTheme } from './xterm-theme';

export interface TerminalConfig {
  workingDir: string;
  iconKey: string;
  iconColor: string;
  theme: 'auto' | 'light' | 'dark';
  fontFamily: string;
  fontSize: number;
  roleId: string | null;
}

interface TerminalNodeProps {
  workspaceId: string;
  node: TerminalNodeInput;
  config: TerminalConfig;
  onChange: (patch: Partial<Pick<TerminalNodeInput, 'x' | 'y' | 'command' | 'runtime'>>) => void;
  onOpenRun: (runId: string) => void;
}

const runtimeLabelByValue: Record<RunRuntimeInput, string> = {
  shell: 'Shell',
  codex: 'Codex',
  claude: 'Claude',
  opencode: 'OpenCode'
};

export const TERMINAL_NODE_RUNTIME_OPTIONS = Object.keys(runtimeLabelByValue) as RunRuntimeInput[];

export const getTerminalRuntimeLabel = (runtime: RunRuntimeInput): string => {
  return runtimeLabelByValue[runtime];
};

const getShellBridge = (): OpenWeaveShellBridge => {
  const shell = (window as Window & { openweaveShell?: OpenWeaveShellBridge }).openweaveShell;
  if (!shell) {
    throw new Error('openweaveShell bridge is unavailable');
  }
  return shell;
};

export const buildTerminalRunStartInput = (input: {
  workspaceId: string;
  node: Pick<TerminalNodeInput, 'id' | 'command'> & { runtime?: RunRuntimeInput };
}): import('../../../../shared/ipc/schemas').RunStartInput => {
  return {
    workspaceId: input.workspaceId,
    nodeId: input.node.id,
    runtime: input.node.runtime ?? 'shell',
    command: input.node.command
  };
};

const isTerminalState = (status: RunRecord['status']): boolean => {
  return status === 'completed' || status === 'failed' || status === 'stopped';
};

export const TerminalNode = ({
  workspaceId,
  node,
  config,
  onChange,
  onOpenRun
}: TerminalNodeProps): JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [draftCommand, setDraftCommand] = useState(node.command);
  const [draftRuntime, setDraftRuntime] = useState<RunRuntimeInput>(node.runtime);
  const latestRun = runs[0] ?? null;
  const latestRunRef = useRef<RunRecord | null>(null);

  // Initialize xterm.js
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: getXtermTheme(config.theme),
      fontFamily: config.fontFamily || 'monospace',
      fontSize: config.fontSize || 14,
      cursorBlink: true,
      convertEol: true,
      scrollback: 1000
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Capture keyboard input
    term.onData((data) => {
      const run = latestRunRef.current;
      if (run && !isTerminalState(run.status)) {
        try {
          getShellBridge().runs.inputRun({
            workspaceId,
            runId: run.id,
            input: data
          });
        } catch {
          // Best-effort input
        }
      }
    });

    return () => {
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // Update theme/font when config changes
  useEffect(() => {
    const term = xtermRef.current;
    if (!term) return;
    term.options.theme = getXtermTheme(config.theme);
    term.options.fontFamily = config.fontFamily || 'monospace';
    term.options.fontSize = config.fontSize || 14;
  }, [config.theme, config.fontFamily, config.fontSize]);

  // Subscribe to real-time stream for active run
  useEffect(() => {
    if (!latestRun) return;

    const bridge = getShellBridge();
    bridge.runs.subscribeStream(latestRun.id);

    const unsubscribe = bridge.runs.onStream((event) => {
      if (event.runId === latestRun.id && xtermRef.current) {
        xtermRef.current.write(event.chunk);
      }
    });

    return () => {
      unsubscribe();
      bridge.runs.unsubscribeStream(latestRun.id);
    };
  }, [latestRun?.id]);

  // ResizeObserver → fitAddon.fit() → resizeRun
  useEffect(() => {
    const container = containerRef.current;
    const term = xtermRef.current;
    if (!container || !term) return;

    const observer = new ResizeObserver(() => {
      fitAddonRef.current?.fit();
      const cols = term.cols;
      const rows = term.rows;
      const run = latestRunRef.current;
      if (run && !isTerminalState(run.status)) {
        try {
          getShellBridge().runs.resizeRun({
            workspaceId,
            runId: run.id,
            cols,
            rows
          });
        } catch {
          // Best-effort resize
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Poll runs list (for history/fallback)
  useEffect(() => {
    let cancelled = false;

    const loadRuns = async (): Promise<void> => {
      try {
        const response = await getShellBridge().runs.listRuns({
          workspaceId,
          nodeId: node.id
        });
        if (cancelled) return;
        setRuns(response.runs);
        setErrorMessage(null);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Failed to load runs';
        setErrorMessage(message);
      }
    };

    void loadRuns();
    const timer = setInterval(() => {
      void loadRuns();
    }, 500);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [workspaceId, node.id]);

  useEffect(() => {
    latestRunRef.current = latestRun;
  }, [latestRun]);

  // Sync draft with node prop
  useEffect(() => {
    setDraftCommand(node.command);
  }, [node.command]);

  useEffect(() => {
    setDraftRuntime(node.runtime);
  }, [node.runtime]);

  const startRun = (): void => {
    if (isStarting || draftCommand.trim().length === 0) return;

    if (draftCommand !== node.command || draftRuntime !== node.runtime) {
      onChange({ command: draftCommand, runtime: draftRuntime });
    }

    setIsStarting(true);
    void getShellBridge()
      .runs.startRun(
        buildTerminalRunStartInput({
          workspaceId,
          node: { ...node, command: draftCommand, runtime: draftRuntime }
        })
      )
      .then((response) => {
        setRuns((currentRuns) => [response.run, ...currentRuns]);
        onOpenRun(response.run.id);
        setErrorMessage(null);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Failed to start run';
        setErrorMessage(message);
      })
      .finally(() => {
        setIsStarting(false);
      });
  };

  return (
    <section className="ow-terminal-node" data-testid={`terminal-node-${node.id}`}>
      <div className="ow-terminal-node__toolbar" data-testid="terminal-node-toolbar">
        <label className="ow-terminal-node__runtime">
          Runtime
          <select
            className="nodrag nopan"
            data-testid={`terminal-node-runtime-${node.id}`}
            onChange={(event) => {
              const nextRuntime = event.currentTarget.value as RunRuntimeInput;
              setDraftRuntime(nextRuntime);
              onChange({ runtime: nextRuntime });
            }}
            value={draftRuntime}
          >
            {TERMINAL_NODE_RUNTIME_OPTIONS.map((runtime) => (
              <option key={runtime} value={runtime}>
                {runtimeLabelByValue[runtime]}
              </option>
            ))}
          </select>
        </label>

        <div className="ow-terminal-node__session" data-testid={`terminal-node-session-${node.id}`}>
          {latestRun ? `Session ${latestRun.id}` : 'Session ready'}
        </div>

        <button
          className="ow-terminal-node__secondary-action nodrag nopan"
          data-testid={`terminal-node-open-run-${node.id}`}
          disabled={!latestRun}
          onClick={() => {
            if (!latestRun) return;
            onOpenRun(latestRun.id);
          }}
          type="button"
        >
          Open run
        </button>
      </div>

      <label className="ow-terminal-node__command">
        Command
        <input
          className="nodrag nopan"
          data-testid={`terminal-node-command-${node.id}`}
          onBlur={() => {
            if (draftCommand !== node.command) {
              onChange({ command: draftCommand });
            }
          }}
          onChange={(event) => setDraftCommand(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              startRun();
            }
          }}
          type="text"
          value={draftCommand}
        />
      </label>

      <div className="ow-terminal-node__actions">
        <button
          className="nodrag nopan"
          data-testid={`terminal-node-run-${node.id}`}
          disabled={isStarting || draftCommand.trim().length === 0}
          onClick={startRun}
          type="button"
        >
          {isStarting ? 'Starting...' : 'Run'}
        </button>
      </div>

      {errorMessage ? (
        <p className="ow-terminal-node__error" data-testid={`terminal-node-error-${node.id}`}>
          {errorMessage}
        </p>
      ) : null}

      <div
        ref={containerRef}
        className="ow-terminal-node__xterm"
        data-testid={`terminal-node-xterm-${node.id}`}
        style={{ width: '100%', flex: 1, minHeight: 120, overflow: 'hidden' }}
      />
    </section>
  );
};
