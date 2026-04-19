import type { ChangeEvent, FormEvent } from 'react';
import type { RunRecord } from '../../../shared/ipc/contracts';

interface TerminalSessionPaneProps {
  run: RunRecord;
  inputValue: string;
  inputErrorMessage: string | null;
  isSubmittingInput: boolean;
  isStopping: boolean;
  onInputChange: (value: string) => void;
  onSubmitInput: () => void;
  onStop: () => void;
}

const isTerminalState = (status: RunRecord['status']): boolean => {
  return status === 'completed' || status === 'failed' || status === 'stopped';
};

const getSessionStateLabel = (run: RunRecord, isStopping: boolean): string => {
  if (run.status === 'stopped') {
    return 'Session stopped.';
  }
  if (run.status === 'completed') {
    return 'Session completed.';
  }
  if (run.status === 'failed') {
    return 'Session failed.';
  }
  if (isStopping) {
    return 'Stopping session...';
  }
  if (run.status === 'queued') {
    return 'Session is starting...';
  }
  return 'Session is active.';
};

export const TerminalSessionPane = ({
  run,
  inputValue,
  inputErrorMessage,
  isSubmittingInput,
  isStopping,
  onInputChange,
  onSubmitInput,
  onStop
}: TerminalSessionPaneProps): JSX.Element => {
  const terminal = isTerminalState(run.status);
  const disableInput = terminal || isSubmittingInput || isStopping;
  const disableSend = disableInput || inputValue.trim().length === 0;
  const disableStop = terminal || isStopping;

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (disableSend) {
      return;
    }
    onSubmitInput();
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onInputChange(event.currentTarget.value);
  };

  return (
    <section
      data-testid="terminal-session-pane"
      style={{
        display: 'grid',
        gap: '8px'
      }}
    >
      <div
        data-testid="terminal-session-meta"
        style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '13px', color: '#475467' }}
      >
        <span>Runtime: {run.runtime}</span>
        <span>Command: {run.command}</span>
      </div>

      <pre
        data-testid="terminal-session-output"
        style={{
          whiteSpace: 'pre-wrap',
          backgroundColor: '#101828',
          color: '#f2f4f7',
          borderRadius: '8px',
          padding: '8px',
          margin: 0,
          minHeight: '160px'
        }}
      >
        {run.tailLog.length > 0 ? run.tailLog : '(no output yet)'}
      </pre>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '8px' }}>
        <label style={{ display: 'grid', gap: '4px' }}>
          Send input
          <input
            data-testid="terminal-session-input"
            disabled={disableInput}
            onChange={handleChange}
            type="text"
            value={inputValue}
          />
        </label>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button data-testid="terminal-session-send" disabled={disableSend} type="submit">
            Send
          </button>
          <button
            data-testid="terminal-session-stop"
            disabled={disableStop}
            onClick={onStop}
            type="button"
          >
            Stop
          </button>
          <span data-testid="terminal-session-state" style={{ color: '#175cd3' }}>
            {getSessionStateLabel(run, isStopping)}
          </span>
        </div>
      </form>

      {inputErrorMessage ? (
        <p data-testid="terminal-session-error" style={{ color: '#b42318', margin: 0 }}>
          {inputErrorMessage}
        </p>
      ) : null}
    </section>
  );
};
