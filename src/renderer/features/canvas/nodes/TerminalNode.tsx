import {JSX, useEffect, useRef, useState} from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { OpenWeaveShellBridge, RunRecord, RunStreamEvent } from '../../../../shared/ipc/contracts';
import type { RunRuntimeInput, TerminalNodeInput } from '../../../../shared/ipc/schemas';
import { isAnsiSafeBoundary } from '../../terminal/ansi-boundary';
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

const getTailEndOffset = (run: RunRecord): number => {
  return typeof run.tailEndOffset === 'number' ? run.tailEndOffset : run.tailLog.length;
};

const getTailStartOffset = (run: RunRecord): number => {
  if (typeof run.tailStartOffset === 'number') {
    return run.tailStartOffset;
  }
  return Math.max(0, getTailEndOffset(run) - run.tailLog.length);
};

const getChunkOffsets = (
  event: RunStreamEvent,
  renderedOffset: number
): { chunkStartOffset: number; chunkEndOffset: number } => {
  const chunkStartOffset =
    typeof event.chunkStartOffset === 'number' ? event.chunkStartOffset : renderedOffset;
  const chunkEndOffset =
    typeof event.chunkEndOffset === 'number' ? event.chunkEndOffset : chunkStartOffset + event.chunk.length;
  return {
    chunkStartOffset,
    chunkEndOffset
  };
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
  const activeRun = runs.find((candidate) => !isTerminalState(candidate.status)) ?? null;
  const displayRun = activeRun ?? latestRun;
  const activeRunRef = useRef<RunRecord | null>(null);
  const isStartingRef = useRef(false);
  const renderedRunIdRef = useRef<string | null>(null);
  const renderedOffsetRef = useRef(0);
  const awaitingSnapshotRef = useRef(false);
  const deferredFocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleWheel = (event: WheelEvent): void => {
      if (container.contains(document.activeElement)) {
        event.stopPropagation();
      }
    };

    container.addEventListener('wheel', handleWheel);
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handlePointerDown = (): void => {
      xtermRef.current?.focus();
      if (deferredFocusTimerRef.current !== null) {
        clearTimeout(deferredFocusTimerRef.current);
      }
      deferredFocusTimerRef.current = setTimeout(() => {
        xtermRef.current?.focus();
        deferredFocusTimerRef.current = null;
      }, 0);
    };

    container.addEventListener('pointerdown', handlePointerDown, { capture: true });
    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      if (deferredFocusTimerRef.current !== null) {
        clearTimeout(deferredFocusTimerRef.current);
        deferredFocusTimerRef.current = null;
      }
    };
  }, []);

  // Initialize xterm.js
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: getXtermTheme(config.theme),
      fontFamily: config.fontFamily || 'monospace',
      fontSize: config.fontSize || 14,
      cursorBlink: true,
      convertEol: false,
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
      const run = activeRunRef.current;
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
    if (!activeRun) return;

    const bridge = getShellBridge();
    bridge.runs.subscribeStream(activeRun.id);

    const unsubscribe = bridge.runs.onStream((event) => {
      if (event.runId === activeRun.id && xtermRef.current) {
        const { chunkStartOffset, chunkEndOffset } = getChunkOffsets(event, renderedOffsetRef.current);
        if (chunkEndOffset <= renderedOffsetRef.current) {
          return;
        }
        if (chunkStartOffset > renderedOffsetRef.current || awaitingSnapshotRef.current) {
          awaitingSnapshotRef.current = true;
          return;
        }

        const suffixStart = Math.max(0, renderedOffsetRef.current - chunkStartOffset);
        const suffix = event.chunk.slice(suffixStart);
        if (suffix.length === 0) {
          renderedOffsetRef.current = chunkEndOffset;
          return;
        }

        xtermRef.current.write(suffix);
        renderedOffsetRef.current = chunkEndOffset;
      }
    });

    return () => {
      unsubscribe();
      bridge.runs.unsubscribeStream(activeRun.id);
    };
  }, [activeRun?.id]);

  // ResizeObserver → fitAddon.fit() → resizeRun
  useEffect(() => {
    const container = containerRef.current;
    const term = xtermRef.current;
    if (!container || !term) return;

    const observer = new ResizeObserver(() => {
      fitAddonRef.current?.fit();
      const cols = term.cols;
      const rows = term.rows;
      const run = activeRunRef.current;
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
    activeRunRef.current = activeRun;
  }, [activeRun]);

  useEffect(() => {
    const term = xtermRef.current;
    if (!term) {
      return;
    }

    if (!displayRun) {
      renderedRunIdRef.current = null;
      renderedOffsetRef.current = 0;
      awaitingSnapshotRef.current = false;
      return;
    }

    const redrawSnapshot = (): void => {
      term.clear();
      renderedRunIdRef.current = displayRun.id;
      renderedOffsetRef.current = getTailEndOffset(displayRun);
      awaitingSnapshotRef.current = false;
      if (displayRun.tailLog.length > 0) {
        term.write(displayRun.tailLog);
      }
    };

    if (renderedRunIdRef.current !== displayRun.id) {
      redrawSnapshot();
      return;
    }

    const tailStartOffset = getTailStartOffset(displayRun);
    const tailEndOffset = getTailEndOffset(displayRun);

    if (activeRun?.id === displayRun.id && !isTerminalState(displayRun.status)) {
      if (tailEndOffset <= renderedOffsetRef.current && !awaitingSnapshotRef.current) {
        return;
      }

      if (tailStartOffset > renderedOffsetRef.current) {
        redrawSnapshot();
        return;
      }

      const suffixStart = Math.max(0, renderedOffsetRef.current - tailStartOffset);
      if (!isAnsiSafeBoundary(displayRun.tailLog, suffixStart)) {
        redrawSnapshot();
        return;
      }
      const suffix = displayRun.tailLog.slice(suffixStart);
      if (suffix.length === 0) {
        renderedOffsetRef.current = tailEndOffset;
        awaitingSnapshotRef.current = false;
        return;
      }

      term.write(suffix);
      renderedOffsetRef.current = tailEndOffset;
      awaitingSnapshotRef.current = false;
      return;
    }

    if (tailEndOffset === renderedOffsetRef.current && !awaitingSnapshotRef.current) {
      return;
    }

    redrawSnapshot();
  }, [activeRun?.id, displayRun?.id, displayRun?.tailLog, displayRun?.tailStartOffset, displayRun?.tailEndOffset, displayRun?.status]);

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
      if (!activeRunRef.current && !isStartingRef.current) {
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
        onFocus={() => {
          xtermRef.current?.focus();
        }}
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
