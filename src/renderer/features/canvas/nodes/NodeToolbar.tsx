interface NodeToolbarProps {
  disabled: boolean;
  onAddNote: () => void;
  onAddTerminal: () => void;
}

export const NodeToolbar = ({ disabled, onAddNote, onAddTerminal }: NodeToolbarProps): JSX.Element => {
  return (
    <div
      data-testid="node-toolbar"
      style={{ display: 'flex', gap: '8px', padding: '8px 0', borderBottom: '1px solid #e4e7ec' }}
    >
      <button data-testid="canvas-add-note" disabled={disabled} onClick={onAddNote} type="button">
        Add note
      </button>
      <button
        data-testid="canvas-add-terminal"
        disabled={disabled}
        onClick={onAddTerminal}
        type="button"
      >
        Add terminal
      </button>
    </div>
  );
};
