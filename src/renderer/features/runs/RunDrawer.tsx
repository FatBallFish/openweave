import { useEffect, useState } from 'react';
import type { OpenWeaveShellBridge, RunRecord } from '../../../shared/ipc/contracts';

interface RunDrawerProps {
  runId: string | null;
  onClose: () => void;
}

const getRunsBridge = (): OpenWeaveShellBridge['runs'] => {
  const shell = (window as Window & { openweaveShell?: OpenWeaveShellBridge }).openweaveShell;
  if (!shell) {
    throw new Error('openweaveShell bridge is unavailable');
  }
  return shell.runs;
};

const isTerminalState = (status: RunRecord['status']): boolean => {
  return status === 'completed' || status === 'failed';
};

export const RunDrawer = ({ runId, onClose }: RunDrawerProps): JSX.Element | null => {
  const [run, setRun] = useState<RunRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) {
      setRun(null);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    const loadRun = async (): Promise<void> => {
      try {
        const result = await getRunsBridge().getRun({ runId });
        if (cancelled) {
          return;
        }
        setRun(result.run);
        setErrorMessage(null);
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Failed to load run details';
        setErrorMessage(message);
      }
    };

    void loadRun();
    const timer = setInterval(() => {
      void loadRun();
    }, 250);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [runId]);

  if (!runId) {
    return null;
  }

  return (
    <aside
      data-testid="run-drawer"
      style={{
        border: '1px solid #d0d7e2',
        borderRadius: '10px',
        padding: '12px',
        marginTop: '16px',
        backgroundColor: '#f8fafc'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Run details</h3>
        <button data-testid="run-drawer-close" onClick={onClose} type="button">
          Close
        </button>
      </div>

      {errorMessage ? (
        <p data-testid="run-drawer-error" style={{ color: '#b42318', marginBottom: 0 }}>
          {errorMessage}
        </p>
      ) : null}

      {run ? (
        <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
          <p data-testid="run-drawer-id" style={{ margin: 0 }}>
            Run: {run.id}
          </p>
          <p data-testid="run-drawer-status" style={{ margin: 0 }}>
            Status: {run.status}
          </p>
          <p data-testid="run-drawer-summary" style={{ margin: 0 }}>
            Summary: {run.summary ?? '(pending)'}
          </p>
          <pre
            data-testid="run-drawer-tail-log"
            style={{
              whiteSpace: 'pre-wrap',
              backgroundColor: '#101828',
              color: '#f2f4f7',
              borderRadius: '8px',
              padding: '8px',
              margin: 0
            }}
          >
            {run.tailLog.length > 0 ? run.tailLog : '(no output yet)'}
          </pre>
          {isTerminalState(run.status) ? (
            <p data-testid="run-drawer-terminal" style={{ margin: 0, color: '#175cd3' }}>
              Run finished.
            </p>
          ) : (
            <p data-testid="run-drawer-progress" style={{ margin: 0, color: '#175cd3' }}>
              Run is still active...
            </p>
          )}
        </div>
      ) : (
        <p data-testid="run-drawer-loading" style={{ marginBottom: 0 }}>
          Loading run...
        </p>
      )}
    </aside>
  );
};
