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
        <div aria-hidden="true" className="ow-workbench-topbar__brand-mark">
          OW
        </div>
        <div className="ow-workbench-topbar__identity-copy">
          <h1 className="ow-workbench-topbar__brand">OpenWeave</h1>
          <span className="ow-workbench-topbar__subtitle">AI engineer workbench</span>
        </div>
      </div>

      <div className="ow-workbench-topbar__actions">
        <div className="ow-workbench-topbar__action-cluster">
          <span className="ow-workbench-topbar__cluster-label">Create</span>
          <button
            className="ow-toolbar-button ow-toolbar-button--primary"
            data-testid="canvas-add-terminal"
            disabled={disabled}
            onClick={onAddTerminal}
            type="button"
          >
            Add terminal
          </button>
          <button
            className="ow-toolbar-button ow-toolbar-button--primary"
            data-testid="canvas-add-note"
            disabled={disabled}
            onClick={onAddNote}
            type="button"
          >
            Add note
          </button>
          <button
            className="ow-toolbar-button ow-toolbar-button--primary"
            data-testid="canvas-add-portal"
            disabled={disabled}
            onClick={onAddPortal}
            type="button"
          >
            Add portal
          </button>
          <button
            className="ow-toolbar-button ow-toolbar-button--primary"
            data-testid="canvas-add-file-tree"
            disabled={disabled}
            onClick={onAddFileTree}
            type="button"
          >
            Add file tree
          </button>
          <button
            className="ow-toolbar-button ow-toolbar-button--primary"
            data-testid="canvas-add-text"
            disabled={disabled}
            onClick={onAddText}
            type="button"
          >
            Add text
          </button>
        </div>

        <div className="ow-workbench-topbar__action-cluster ow-workbench-topbar__action-cluster--utility">
          <span className="ow-workbench-topbar__cluster-label">Canvas</span>
          <button className="ow-toolbar-button" disabled={searchDisabled} type="button">
            Search
          </button>
          <button
            className="ow-toolbar-button"
            disabled={commandMenuDisabled}
            onClick={onOpenCommandMenu}
            type="button"
          >
            Command menu
          </button>
          <button
            className="ow-toolbar-button"
            disabled={fitViewDisabled}
            onClick={onFitCanvas}
            type="button"
          >
            Fit view
          </button>
          <button
            className="ow-toolbar-button"
            disabled={settingsDisabled}
            onClick={onOpenSettings}
            type="button"
          >
            Settings
          </button>
        </div>
      </div>

      <div className="ow-workbench-topbar__status-group">
        <div className="ow-workbench-topbar__workspace-pill" data-testid="workbench-topbar-workspace-pill">
          <span className="ow-workbench-topbar__pill-label">Workspace</span>
          <strong>{workspaceName ?? 'No workspace'}</strong>
        </div>
        <div className="ow-workbench-topbar__status">
          <span>Workflow shell active</span>
          <strong>Cmd/Ctrl+K</strong>
        </div>
      </div>
    </header>
  );
};
