interface WorkbenchInspectorProps {
  workspaceName: string | null;
  workspaceRootDir: string | null;
  selectedNode?: {
    id: string;
    title: string;
    componentType: string;
    capabilities: string[];
  } | null;
  nodeCount?: number;
  edgeCount?: number;
  recentAction?: string | null;
  collapsed?: boolean;
  onToggle?: () => void;
}

export const WorkbenchInspector = ({
  workspaceName,
  workspaceRootDir,
  selectedNode = null,
  nodeCount = 0,
  edgeCount = 0,
  recentAction = null,
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
          <h2 className="ow-workbench-inspector__title">
            {selectedNode?.title ?? workspaceName ?? 'Nothing selected'}
          </h2>
        </div>
        <button data-testid="workbench-inspector-toggle" onClick={onToggle} type="button">
          Collapse
        </button>
      </div>

      <section className="ow-workbench-inspector__section">
        <h3>Selected node</h3>
        {selectedNode ? (
          <>
            <p>{selectedNode.title}</p>
            <code>{selectedNode.componentType}</code>
            <div className="ow-workbench-inspector__capabilities">
              {selectedNode.capabilities.map((capability) => (
                <span key={capability}>{capability}</span>
              ))}
            </div>
          </>
        ) : (
          <p>
            {workspaceName
              ? 'Pick a node on the canvas to inspect its component interface and runtime state.'
              : 'Select or open a workspace to populate the canvas and controls.'}
          </p>
        )}
      </section>

      <section className="ow-workbench-inspector__section">
        <h3>Canvas summary</h3>
        <div className="ow-workbench-inspector__stats">
          <div>
            <span>Nodes</span>
            <strong>{nodeCount}</strong>
          </div>
          <div>
            <span>Edges</span>
            <strong>{edgeCount}</strong>
          </div>
        </div>
        <p>{recentAction ?? 'No recent actions yet.'}</p>
      </section>

      <section className="ow-workbench-inspector__section">
        <h3>Workspace root</h3>
        <code>{workspaceRootDir ?? 'Awaiting active workspace'}</code>
      </section>

      <section className="ow-workbench-inspector__section">
        <h3>Quick actions</h3>
        <ul>
          <li>/ Quick add</li>
          <li>Cmd/Ctrl+K Command palette</li>
          <li>Cmd/Ctrl+Shift+I Toggle inspector</li>
        </ul>
      </section>
    </aside>
  );
};
