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
    return 'Session stopped';
  }
  if (run.status === 'completed') {
    return 'Session completed';
  }
  if (run.status === 'failed') {
    return 'Session failed';
  }
  if (isStopping) {
    return 'Stopping session';
  }
  if (run.status === 'queued') {
    return 'Session starting';
  }
  return 'Session active';
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
    <section className="ow-terminal-session-pane" data-testid="terminal-session-pane">
      <div className="ow-terminal-session-pane__toolbar" data-testid="terminal-session-toolbar">
        <span className="ow-terminal-session-pane__chip">{getSessionStateLabel(run, isStopping)}</span>
        <span className="ow-terminal-session-pane__chip" data-testid="terminal-session-meta">
          Runtime {run.runtime}
        </span>
        <span className="ow-terminal-session-pane__chip">Command {run.command}</span>
      </div>

      <div className="ow-terminal-session-pane__output">
        <div className="ow-terminal-session-pane__output-header">
          <strong>Live output</strong>
          <span>Session</span>
        </div>
        <pre className="ow-terminal-session-pane__output-surface" data-testid="terminal-session-output">
          {run.tailLog.length > 0 ? run.tailLog : '(no output yet)'}
        </pre>
      </div>

      <form className="ow-terminal-session-pane__form" onSubmit={handleSubmit}>
        <label className="ow-terminal-session-pane__input-field">
          Send input
          <input
            data-testid="terminal-session-input"
            disabled={disableInput}
            onChange={handleChange}
            type="text"
            value={inputValue}
          />
        </label>

        <div className="ow-terminal-session-pane__actions">
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
          <span className="ow-terminal-session-pane__state" data-testid="terminal-session-state">
            {getSessionStateLabel(run, isStopping)}
          </span>
        </div>
      </form>

      {inputErrorMessage ? (
        <p className="ow-terminal-session-pane__error" data-testid="terminal-session-error">
          {inputErrorMessage}
        </p>
      ) : null}
    </section>
  );
};
