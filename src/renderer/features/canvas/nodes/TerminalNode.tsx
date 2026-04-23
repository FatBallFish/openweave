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
  const latestRun = runs[0] ?? null;
  const latestRunRef = useRef<RunRecord | null>(null);
  const isStartingRef = useRef(false);
  const renderedRunIdRef = useRef<string | null>(null);

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
    term.focus();

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

  useEffect(() => {
    const term = xtermRef.current;
    if (!term || !latestRun) {
      return;
    }

    if (renderedRunIdRef.current !== latestRun.id) {
      term.clear();
      renderedRunIdRef.current = latestRun.id;
      if (latestRun.tailLog.length > 0) {
        term.write(latestRun.tailLog);
      }
    }
  }, [latestRun?.id, latestRun?.tailLog]);

  useEffect(() => {
    isStartingRef.current = isStarting;
  }, [isStarting]);

  const startRun = (): void => {
    if (isStartingRef.current) return;

    const effectiveRuntime = node.runtime ?? 'shell';

    setIsStarting(true);
    void getShellBridge()
      .runs.startRun(
        buildTerminalRunStartInput({
          workspaceId,
          node: { ...node, command: node.command, runtime: effectiveRuntime }
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

  // Auto-start terminal on mount if no active run
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!latestRunRef.current && !isStartingRef.current) {
        startRun();
      }
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="ow-terminal-node" data-testid={`terminal-node-${node.id}`}>
      {errorMessage ? (
        <p className="ow-terminal-node__error" data-testid={`terminal-node-error-${node.id}`}>
          {errorMessage}
        </p>
      ) : null}

      <div
        ref={containerRef}
        className="ow-terminal-node__xterm nodrag nopan"
        data-testid={`terminal-node-xterm-${node.id}`}
        style={{ width: '100%', height: '100%', overflow: 'hidden' }}
        tabIndex={0}
        onPointerDown={(e) => {
          e.stopPropagation();
          xtermRef.current?.focus();
        }}
        onClick={(e) => {
          e.stopPropagation();
          xtermRef.current?.focus();
        }}
      />
    </section>
  );
};
