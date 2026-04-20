interface WorkbenchTopBarProps {
  workspaceName: string | null;
  disabled: boolean;
  searchDisabled: boolean;
  commandMenuDisabled: boolean;
  fitViewDisabled: boolean;
  settingsDisabled: boolean;
  onAddTerminal: () => void;
  onAddNote: () => void;
  onAddPortal: () => void;
  onAddFileTree: () => void;
  onAddText: () => void;
  onOpenCommandMenu: () => void;
  onFitCanvas: () => void;
  onOpenSettings: () => void;
}

export const WorkbenchTopBar = ({
  workspaceName,
  disabled,
  searchDisabled,
  commandMenuDisabled,
  fitViewDisabled,
  settingsDisabled,
  onAddTerminal,
  onAddNote,
  onAddPortal,
  onAddFileTree,
  onAddText,
  onOpenCommandMenu,
  onFitCanvas,
  onOpenSettings
}: WorkbenchTopBarProps): JSX.Element => {
  return (
    <header className="ow-workbench-topbar" data-testid="workbench-topbar">
      <div className="ow-workbench-topbar__identity">
        <h1 className="ow-workbench-topbar__brand">OpenWeave</h1>
        <span className="ow-workbench-topbar__subtitle">AI engineer workbench</span>
      </div>

      <div className="ow-workbench-topbar__actions">
        <button className="ow-toolbar-button ow-toolbar-button--primary" data-testid="canvas-add-terminal" disabled={disabled} onClick={onAddTerminal} type="button">
          Add terminal
        </button>
        <button className="ow-toolbar-button ow-toolbar-button--primary" data-testid="canvas-add-note" disabled={disabled} onClick={onAddNote} type="button">
          Add note
        </button>
        <button className="ow-toolbar-button ow-toolbar-button--primary" data-testid="canvas-add-portal" disabled={disabled} onClick={onAddPortal} type="button">
          Add portal
        </button>
        <button className="ow-toolbar-button ow-toolbar-button--primary" data-testid="canvas-add-file-tree" disabled={disabled} onClick={onAddFileTree} type="button">
          Add file tree
        </button>
        <button className="ow-toolbar-button ow-toolbar-button--primary" data-testid="canvas-add-text" disabled={disabled} onClick={onAddText} type="button">
          Add text
        </button>
        <button className="ow-toolbar-button" disabled={searchDisabled} type="button">
          Search
        </button>
        <button className="ow-toolbar-button" disabled={commandMenuDisabled} onClick={onOpenCommandMenu} type="button">
          Command menu
        </button>
        <button className="ow-toolbar-button" disabled={fitViewDisabled} onClick={onFitCanvas} type="button">
          Fit view
        </button>
        <button className="ow-toolbar-button" disabled={settingsDisabled} onClick={onOpenSettings} type="button">
          Settings
        </button>
      </div>

      <div className="ow-workbench-topbar__status-group">
        <div className="ow-workbench-topbar__workspace-pill" data-testid="workbench-topbar-workspace-pill">
          {workspaceName ?? 'No workspace'}
        </div>
        <div className="ow-workbench-topbar__status">Workflow shell active</div>
      </div>
    </header>
  );
};
