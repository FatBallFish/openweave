import {JSX, useEffect, useRef} from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { OpenWeaveShellBridge, RunRecord, RunStreamEvent } from '../../../shared/ipc/contracts';
import { getXtermTheme } from '../canvas/nodes/xterm-theme';
import { TerminalOutputSanitizer } from '../terminal/ansi-output';

interface TerminalSessionPaneProps {
  run: RunRecord;
  isStopping: boolean;
  onStop: () => void;
}

const isTerminalState = (status: RunRecord['status']): boolean => {
  return status === 'completed' || status === 'failed' || status === 'stopped';
};

const getSessionStateLabel = (run: RunRecord, isStopping: boolean): string => {
  if (run.status === 'stopped') return 'Session stopped';
  if (run.status === 'completed') return 'Session completed';
  if (run.status === 'failed') return 'Session failed';
  if (isStopping) return 'Stopping session';
  if (run.status === 'queued') return 'Session starting';
  return 'Session active';
};

const getShellBridge = (): OpenWeaveShellBridge => {
  const shell = (window as Window & { openweaveShell?: OpenWeaveShellBridge }).openweaveShell;
  if (!shell) throw new Error('openweaveShell bridge is unavailable');
  return shell;
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

export const TerminalSessionPane = ({
  run,
  isStopping,
  onStop
}: TerminalSessionPaneProps): JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const runRef = useRef<RunRecord>(run);
  const renderedRunIdRef = useRef<string | null>(null);
  const renderedOffsetRef = useRef(0);
  const awaitingSnapshotRef = useRef(false);
  const outputSanitizerRef = useRef(new TerminalOutputSanitizer());
  const terminal = isTerminalState(run.status);
  const disableStop = terminal || isStopping;

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: getXtermTheme('auto'),
      fontFamily: 'monospace',
      fontSize: 14,
      cursorBlink: true,
      convertEol: false,
      scrollback: 5000
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();
    term.focus();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.onData((data) => {
      const currentRun = runRef.current;
      if (!isTerminalState(currentRun.status)) {
        try {
          getShellBridge().runs.inputRun({
            workspaceId: currentRun.workspaceId,
            runId: currentRun.id,
            input: data
          });
        } catch {
          // Best-effort
        }
      }
    });

    return () => {
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // Subscribe to stream
  useEffect(() => {
    const bridge = getShellBridge();
    bridge.runs.subscribeStream(run.id);

    const unsubscribe = bridge.runs.onStream((event) => {
      if (event.runId === run.id && xtermRef.current) {
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

        const sanitizedSuffix = outputSanitizerRef.current.sanitize(suffix);
        if (sanitizedSuffix.length > 0) {
          xtermRef.current.write(sanitizedSuffix);
        }
        renderedOffsetRef.current = chunkEndOffset;
      }
    });

    return () => {
      unsubscribe();
      bridge.runs.unsubscribeStream(run.id);
    };
  }, [run.id]);

  // ResizeObserver
  useEffect(() => {
    const term = xtermRef.current;
    if (!term) {
      return;
    }

    const redrawSnapshot = (): void => {
      outputSanitizerRef.current.reset();
      if (renderedRunIdRef.current !== null && renderedRunIdRef.current !== run.id) {
        term.clear();
      }
      renderedRunIdRef.current = run.id;
      renderedOffsetRef.current = getTailEndOffset(run);
      awaitingSnapshotRef.current = false;
      if (run.tailLog.length > 0) {
        const sanitizedTail = outputSanitizerRef.current.sanitize(run.tailLog);
        if (sanitizedTail.length > 0) {
          term.write(sanitizedTail);
        }
      }
    };

    if (renderedRunIdRef.current !== run.id) {
      redrawSnapshot();
      return;
    }

    const tailStartOffset = getTailStartOffset(run);
    const tailEndOffset = getTailEndOffset(run);

    if (tailEndOffset <= renderedOffsetRef.current && !awaitingSnapshotRef.current) {
      return;
    }

    if (tailStartOffset > renderedOffsetRef.current) {
      // Do not recover by clearing xterm: that destroys scrollback for long-running TUIs.
      outputSanitizerRef.current.reset();
      renderedOffsetRef.current = tailEndOffset;
      awaitingSnapshotRef.current = false;
      return;
    }

    const suffixStart = Math.max(0, renderedOffsetRef.current - tailStartOffset);
    const suffix = run.tailLog.slice(suffixStart);
    if (suffix.length === 0) {
      renderedOffsetRef.current = tailEndOffset;
      awaitingSnapshotRef.current = false;
      return;
    }

    const sanitizedSuffix = outputSanitizerRef.current.sanitize(suffix);
    if (sanitizedSuffix.length > 0) {
      term.write(sanitizedSuffix);
    }
    renderedOffsetRef.current = tailEndOffset;
    awaitingSnapshotRef.current = false;
  }, [run.id, run.tailLog, run.tailStartOffset, run.tailEndOffset, terminal]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      fitAddonRef.current?.fit();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="ow-terminal-session-pane" data-testid="terminal-session-pane">
      <div className="ow-terminal-session-pane__toolbar" data-testid="terminal-session-toolbar">
        <span className="ow-terminal-session-pane__chip">{getSessionStateLabel(run, isStopping)}</span>
        <span className="ow-terminal-session-pane__chip" data-testid="terminal-session-meta">
          Runtime {run.runtime}
        </span>
        <span className="ow-terminal-session-pane__chip">Command {run.command}</span>
        <button
          className="ow-toolbar-button"
          data-testid="terminal-session-stop"
          disabled={disableStop}
          onClick={onStop}
          type="button"
        >
          Stop
        </button>
      </div>

      <div
        ref={containerRef}
        className="ow-terminal-session-pane__xterm nodrag nopan"
        data-testid="terminal-session-xterm"
        style={{ width: '100%', height: 360, overflow: 'hidden' }}
        tabIndex={0}
        onPointerDown={(event) => {
          event.stopPropagation();
          xtermRef.current?.focus();
        }}
        onClick={(event) => {
          event.stopPropagation();
          xtermRef.current?.focus();
        }}
      />
    </section>
  );
};
