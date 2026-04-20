interface WorkbenchTopBarProps {
  workspaceName: string | null;
}

export const WorkbenchTopBar = ({ workspaceName }: WorkbenchTopBarProps): JSX.Element => {
  return (
    <header className="ow-workbench-topbar" data-testid="workbench-topbar">
      <div className="ow-workbench-topbar__identity">
        <h1 className="ow-workbench-topbar__brand">OpenWeave</h1>
        <span className="ow-workbench-topbar__subtitle">AI engineer workbench</span>
      </div>

      <div className="ow-workbench-topbar__actions">
        <button className="ow-toolbar-button ow-toolbar-button--primary" disabled type="button">
          Create
        </button>
        <button className="ow-toolbar-button" disabled type="button">
          Search
        </button>
        <button className="ow-toolbar-button" disabled type="button">
          Settings
        </button>
      </div>

      <div className="ow-workbench-topbar__status-group">
        <div className="ow-workbench-topbar__workspace-pill" data-testid="workbench-topbar-workspace-pill">
          {workspaceName ?? 'No workspace'}
        </div>
        <div className="ow-workbench-topbar__status">Workbench ready</div>
      </div>
    </header>
  );
};
