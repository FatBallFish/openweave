interface NodeToolbarProps {
  disabled: boolean;
  onAddNote: () => void;
  onAddTerminal: () => void;
  onAddFileTree: () => void;
  onAddPortal: () => void;
}

export const NodeToolbar = ({
  disabled,
  onAddNote,
  onAddTerminal,
  onAddFileTree,
  onAddPortal
}: NodeToolbarProps): JSX.Element => {
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
      <button
        data-testid="canvas-add-file-tree"
        disabled={disabled}
        onClick={onAddFileTree}
        type="button"
      >
        Add file tree
      </button>
      <button data-testid="canvas-add-portal" disabled={disabled} onClick={onAddPortal} type="button">
        Add portal
      </button>
    </div>
  );
};
