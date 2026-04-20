import { useEffect, useState } from 'react';
import type { OpenWeaveShellBridge, RunRecord } from '../../../../shared/ipc/contracts';
import type { RunRuntimeInput, RunStartInput, TerminalNodeInput } from '../../../../shared/ipc/schemas';

interface TerminalNodeProps {
  workspaceId: string;
  node: TerminalNodeInput;
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
}): RunStartInput => {
  return {
    workspaceId: input.workspaceId,
    nodeId: input.node.id,
    runtime: input.node.runtime ?? 'shell',
    command: input.node.command
  };
};

export const TerminalNode = ({
  workspaceId,
  node,
  onChange,
  onOpenRun
}: TerminalNodeProps): JSX.Element => {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [draftCommand, setDraftCommand] = useState(node.command);
  const [draftRuntime, setDraftRuntime] = useState<RunRuntimeInput>(node.runtime);
  const latestRun = runs[0] ?? null;
  const sessionLabel = latestRun ? `Session ${latestRun.id}` : 'Session ready';
  const output = latestRun?.tailLog.length ? latestRun.tailLog : '(no output yet)';
  const startRun = (): void => {
    if (isStarting || draftCommand.trim().length === 0) {
      return;
    }

    if (draftCommand !== node.command || draftRuntime !== node.runtime) {
      onChange({
        command: draftCommand,
        runtime: draftRuntime
      });
    }

    setIsStarting(true);
    void getShellBridge()
      .runs.startRun(
        buildTerminalRunStartInput({
          workspaceId,
          node: {
            ...node,
            command: draftCommand,
            runtime: draftRuntime
          }
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

  useEffect(() => {
    setDraftCommand(node.command);
  }, [node.command]);

  useEffect(() => {
    setDraftRuntime(node.runtime);
  }, [node.runtime]);

  useEffect(() => {
    let cancelled = false;

    const loadRuns = async (): Promise<void> => {
      try {
        const response = await getShellBridge().runs.listRuns({
          workspaceId,
          nodeId: node.id
        });
        if (cancelled) {
          return;
        }
        setRuns(response.runs);
        setErrorMessage(null);
      } catch (error) {
        if (cancelled) {
          return;
        }
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
          {sessionLabel}
        </div>

        <button
          className="ow-terminal-node__secondary-action nodrag nopan"
          data-testid={`terminal-node-open-run-${node.id}`}
          disabled={!latestRun}
          onClick={() => {
            if (!latestRun) {
              return;
            }
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
        <button
          className="ow-terminal-node__secondary-action nodrag nopan"
          data-testid={`terminal-node-copy-command-${node.id}`}
          onClick={() => {
            if (typeof navigator !== 'undefined' && navigator.clipboard) {
              void navigator.clipboard.writeText(draftCommand);
            }
          }}
          type="button"
        >
          Copy command
        </button>
        <span data-testid={`terminal-node-last-status-${node.id}`}>
          Last status: {latestRun?.status ?? 'none'}
        </span>
      </div>

      {errorMessage ? (
        <p className="ow-terminal-node__error" data-testid={`terminal-node-error-${node.id}`}>
          {errorMessage}
        </p>
      ) : null}

      <div className="ow-terminal-node__output">
        <div className="ow-terminal-node__output-header">
          <strong>Session output</strong>
          <span>{getTerminalRuntimeLabel(draftRuntime)}</span>
        </div>
        <pre className="ow-terminal-node__output-surface" data-testid={`terminal-node-output-${node.id}`}>
          {output}
        </pre>
      </div>

      <div className="ow-terminal-node__runs" data-testid={`terminal-node-runs-${node.id}`}>
        {runs.length === 0 ? (
          <p className="ow-terminal-node__empty">No runs yet.</p>
        ) : (
          runs.map((run) => (
            <button
              className="ow-terminal-node__run-item nodrag nopan"
              data-testid={`terminal-run-${run.id}`}
              key={run.id}
              onClick={() => onOpenRun(run.id)}
              type="button"
            >
              <strong>{run.status}</strong>
              <div>{run.summary ?? run.command}</div>
            </button>
          ))
        )}
      </div>
    </section>
  );
};
