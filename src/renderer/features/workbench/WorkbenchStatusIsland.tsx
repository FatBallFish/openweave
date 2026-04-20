interface WorkbenchStatusIslandProps {
  hasActiveWorkspace: boolean;
}

export const WorkbenchStatusIsland = ({ hasActiveWorkspace }: WorkbenchStatusIslandProps): JSX.Element => {
  return (
    <div className="ow-workbench-status-island" data-testid="workbench-status-island">
      <div className="ow-workbench-status-island__item">
        <span className="ow-workbench-status-island__label">Status</span>
        <strong>{hasActiveWorkspace ? 'Ready' : 'Idle'}</strong>
      </div>
      <div className="ow-workbench-status-island__item">
        <span className="ow-workbench-status-island__label">Events</span>
        <strong>0</strong>
      </div>
      <div className="ow-workbench-status-island__item">
        <span className="ow-workbench-status-island__label">Tasks</span>
        <strong>{hasActiveWorkspace ? '1' : '0'}</strong>
      </div>
    </div>
  );
};
