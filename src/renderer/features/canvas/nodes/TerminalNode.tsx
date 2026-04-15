import { useEffect, useState } from 'react';
import type { OpenWeaveShellBridge, RunRecord } from '../../../../shared/ipc/contracts';
import type { TerminalNodeInput } from '../../../../shared/ipc/schemas';

interface TerminalNodeProps {
  workspaceId: string;
  node: TerminalNodeInput;
  onChange: (patch: Partial<Pick<TerminalNodeInput, 'x' | 'y' | 'command'>>) => void;
  onOpenRun: (runId: string) => void;
}

const getShellBridge = (): OpenWeaveShellBridge => {
  const shell = (window as Window & { openweaveShell?: OpenWeaveShellBridge }).openweaveShell;
  if (!shell) {
    throw new Error('openweaveShell bridge is unavailable');
  }
  return shell;
};

const parseNumberOrUndefined = (value: string): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
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
    }, 250);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [workspaceId, node.id]);

  return (
    <article
      data-testid={`terminal-node-${node.id}`}
      style={{
        border: '1px solid #84adff',
        borderRadius: '8px',
        padding: '12px',
        display: 'grid',
        gap: '8px',
        backgroundColor: '#eff4ff'
      }}
    >
      <label style={{ display: 'grid', gap: '4px' }}>
        Command
        <input
          data-testid={`terminal-node-command-${node.id}`}
          onChange={(event) => onChange({ command: event.currentTarget.value })}
          type="text"
          value={node.command}
        />
      </label>

      <div style={{ display: 'flex', gap: '8px' }}>
        <label style={{ display: 'grid', gap: '4px' }}>
          X
          <input
            data-testid={`terminal-node-x-${node.id}`}
            onChange={(event) => {
              const nextX = parseNumberOrUndefined(event.currentTarget.value);
              if (nextX !== undefined) {
                onChange({ x: nextX });
              }
            }}
            type="number"
            value={node.x}
          />
        </label>

        <label style={{ display: 'grid', gap: '4px' }}>
          Y
          <input
            data-testid={`terminal-node-y-${node.id}`}
            onChange={(event) => {
              const nextY = parseNumberOrUndefined(event.currentTarget.value);
              if (nextY !== undefined) {
                onChange({ y: nextY });
              }
            }}
            type="number"
            value={node.y}
          />
        </label>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          data-testid={`terminal-node-run-${node.id}`}
          disabled={isStarting || node.command.trim().length === 0}
          onClick={() => {
            setIsStarting(true);
            void getShellBridge()
              .runs.startRun({
                workspaceId,
                nodeId: node.id,
                runtime: 'shell',
                command: node.command
              })
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
          }}
          type="button"
        >
          Run
        </button>
        <span data-testid={`terminal-node-last-status-${node.id}`}>
          Last status: {runs[0]?.status ?? 'none'}
        </span>
      </div>

      {errorMessage ? (
        <p data-testid={`terminal-node-error-${node.id}`} style={{ color: '#b42318', margin: 0 }}>
          {errorMessage}
        </p>
      ) : null}

      <div data-testid={`terminal-node-runs-${node.id}`} style={{ display: 'grid', gap: '6px' }}>
        {runs.length === 0 ? (
          <p style={{ margin: 0 }}>No runs yet.</p>
        ) : (
          runs.map((run) => (
            <button
              data-testid={`terminal-run-${run.id}`}
              key={run.id}
              onClick={() => onOpenRun(run.id)}
              style={{
                textAlign: 'left',
                border: '1px solid #c7d7fe',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                padding: '8px'
              }}
              type="button"
            >
              <strong>{run.status}</strong>
              <div style={{ fontSize: '13px', color: '#344054' }}>
                {run.summary ?? run.command}
              </div>
            </button>
          ))
        )}
      </div>
    </article>
  );
};
