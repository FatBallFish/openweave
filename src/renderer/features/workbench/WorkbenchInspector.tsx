interface WorkbenchInspectorProps {
  workspaceName: string | null;
  workspaceRootDir: string | null;
  collapsed?: boolean;
  onToggle?: () => void;
}

export const WorkbenchInspector = ({
  workspaceName,
  workspaceRootDir,
  collapsed = false,
  onToggle
}: WorkbenchInspectorProps): JSX.Element => {
  if (collapsed) {
    return (
      <aside
        className="ow-workbench-inspector ow-workbench-inspector--collapsed"
        data-testid="workbench-inspector"
      >
        <button data-testid="workbench-inspector-toggle" onClick={onToggle} type="button">
          Expand
        </button>
        <div data-testid="workbench-inspector-collapsed" className="ow-workbench-inspector__collapsed-badge">
          {workspaceName ? workspaceName.slice(0, 2).toUpperCase() : 'IN'}
        </div>
      </aside>
    );
  }

  return (
    <aside className="ow-workbench-inspector" data-testid="workbench-inspector">
      <div className="ow-workbench-inspector__header">
        <div>
          <p className="ow-workbench-inspector__eyebrow">Inspector</p>
          <h2 className="ow-workbench-inspector__title">{workspaceName ?? 'Nothing selected'}</h2>
        </div>
        <button data-testid="workbench-inspector-toggle" onClick={onToggle} type="button">
          Collapse
        </button>
      </div>

      <section className="ow-workbench-inspector__section">
        <h3>Selection</h3>
        <p>
          {workspaceName
            ? 'Workspace context is loaded and ready for orchestration.'
            : 'Select or open a workspace to populate the canvas and controls.'}
        </p>
      </section>

      <section className="ow-workbench-inspector__section">
        <h3>Workspace root</h3>
        <code>{workspaceRootDir ?? 'Awaiting active workspace'}</code>
      </section>

      <section className="ow-workbench-inspector__section">
        <h3>Next controls</h3>
        <ul>
          <li>Node parameters</li>
          <li>Connection metadata</li>
          <li>Run diagnostics</li>
        </ul>
      </section>
    </aside>
  );
};
