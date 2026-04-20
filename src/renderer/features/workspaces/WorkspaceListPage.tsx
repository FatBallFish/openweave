import { useEffect } from 'react';
import { BranchWorkspaceDialog } from './BranchWorkspaceDialog';
import { CreateWorkspaceDialog } from './CreateWorkspaceDialog';
import { useWorkspacesStore, workspacesStore } from './workspaces.store';

interface WorkspaceListPageProps {
  variant?: 'page' | 'panel';
}

export const WorkspaceListPage = ({ variant = 'page' }: WorkspaceListPageProps): JSX.Element => {
  const workspaces = useWorkspacesStore((storeState) => storeState.workspaces);
  const activeWorkspaceId = useWorkspacesStore((storeState) => storeState.activeWorkspaceId);
  const loading = useWorkspacesStore((storeState) => storeState.loading);
  const isCreateDialogOpen = useWorkspacesStore((storeState) => storeState.isCreateDialogOpen);
  const isBranchDialogOpen = useWorkspacesStore((storeState) => storeState.isBranchDialogOpen);
  const branchSourceWorkspaceId = useWorkspacesStore((storeState) => storeState.branchSourceWorkspaceId);
  const errorMessage = useWorkspacesStore((storeState) => storeState.errorMessage);

  useEffect(() => {
    void workspacesStore.loadWorkspaces();
  }, []);

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
  const branchSourceWorkspace =
    workspaces.find((workspace) => workspace.id === branchSourceWorkspaceId) ?? null;
  const heading = variant === 'panel' ? 'Workspaces' : 'Workspace registry';
  const description =
    variant === 'panel'
      ? 'Open a workspace, branch it, or create a fresh one.'
      : 'Create, open, and delete registry-backed workspaces.';

  return (
    <section className={`ow-workspace-list ow-workspace-list--${variant}`} data-testid="workspace-list-page">
      <header className="ow-workspace-list__header">
        <h2>{heading}</h2>
        <p>{description}</p>
      </header>

      <div className="ow-workspace-list__actions">
        <button
          className="ow-toolbar-button ow-toolbar-button--primary"
          data-testid="workspace-create-button"
          disabled={loading}
          onClick={() => workspacesStore.openCreateDialog()}
          type="button"
        >
          Create workspace
        </button>
      </div>

      <CreateWorkspaceDialog
        open={isCreateDialogOpen}
        loading={loading}
        onCancel={() => workspacesStore.closeCreateDialog()}
        onCreate={(input) => workspacesStore.createWorkspace(input)}
      />
      <BranchWorkspaceDialog
        open={isBranchDialogOpen}
        loading={loading}
        sourceWorkspace={branchSourceWorkspace}
        onCancel={() => workspacesStore.closeBranchDialog()}
        onCreate={(input) => workspacesStore.createBranchWorkspace(input)}
      />

      {errorMessage ? (
        <p className="ow-workspace-list__error" data-testid="workspace-error">
          {errorMessage}
        </p>
      ) : null}

      <div className="ow-workspace-list__active" data-testid="active-workspace-name">
        <span className="ow-workspace-list__eyebrow">Active workspace</span>
        <div className="ow-workspace-list__active-body">
          <strong>{activeWorkspace?.name ?? 'none'}</strong>
          <span>{activeWorkspace?.rootDir ?? 'Open a workspace to mount repo context.'}</span>
        </div>
      </div>

      {workspaces.length === 0 ? (
        <p className="ow-workspace-list__empty" data-testid="workspace-empty">
          No workspaces yet.
        </p>
      ) : (
        <ul className="ow-workspace-list__items" data-testid="workspace-list">
          {workspaces.map((workspace) => (
            <li
              key={workspace.id}
              className="ow-workspace-list__item"
              data-testid={`workspace-row-${workspace.id}`}
            >
              <div className="ow-workspace-list__item-meta">
                <div className="ow-workspace-list__item-heading">
                  <strong>{workspace.name}</strong>
                  <span
                    className={`ow-workspace-list__item-badge${
                      workspace.id === activeWorkspaceId ? ' is-active' : ''
                    }`}
                  >
                    {workspace.id === activeWorkspaceId ? 'Open' : 'Ready'}
                  </span>
                </div>
                <code className="ow-workspace-list__item-path">{workspace.rootDir}</code>
              </div>
              <div className="ow-workspace-list__item-actions">
                <button
                  aria-label={`Open ${workspace.name}`}
                  className="ow-toolbar-button ow-toolbar-button--primary"
                  data-testid={`workspace-open-${workspace.id}`}
                  disabled={loading}
                  onClick={() => void workspacesStore.openWorkspace(workspace.id)}
                  type="button"
                >
                  Open
                </button>
                <button
                  aria-label={`Branch ${workspace.name}`}
                  className="ow-toolbar-button"
                  data-testid={`workspace-branch-${workspace.id}`}
                  disabled={loading}
                  onClick={() => workspacesStore.openBranchDialog(workspace.id)}
                  type="button"
                >
                  Branch
                </button>
                <button
                  aria-label={`Delete ${workspace.name}`}
                  className="ow-toolbar-button ow-toolbar-button--danger"
                  data-testid={`workspace-delete-${workspace.id}`}
                  disabled={loading}
                  onClick={() => void workspacesStore.deleteWorkspace(workspace.id)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
