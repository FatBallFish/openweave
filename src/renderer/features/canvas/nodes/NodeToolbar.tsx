export const NodeToolbar = (): JSX.Element => {
  return (
    <div
      data-testid="node-toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 0',
        borderBottom: '1px solid #d7e3ef',
        color: '#5f7790',
        fontSize: '13px'
      }}
    >
      <strong style={{ color: '#10253d' }}>Canvas quick guide</strong>
      <span data-testid="canvas-quick-insert-hint">/ Quick insert</span>
      <span data-testid="canvas-command-menu-hint">Cmd/Ctrl+K Command menu</span>
      <span data-testid="canvas-pan-hint">Space Pan</span>
    </div>
  );
};
