export const NodeToolbar = (): JSX.Element => {
  return (
    <div className="ow-node-toolbar" data-testid="node-toolbar">
      <strong className="ow-node-toolbar__title">Canvas quick guide</strong>
      <span className="ow-node-toolbar__hint" data-testid="canvas-quick-insert-hint">
        / Quick insert
      </span>
      <span className="ow-node-toolbar__hint" data-testid="canvas-command-menu-hint">
        Cmd/Ctrl+K Command menu
      </span>
      <span className="ow-node-toolbar__hint" data-testid="canvas-pan-hint">
        Space Pan
      </span>
    </div>
  );
};
