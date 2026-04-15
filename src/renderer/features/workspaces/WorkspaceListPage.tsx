import { useEffect } from 'react';
import { CreateWorkspaceDialog } from './CreateWorkspaceDialog';
import { useWorkspacesStore, workspacesStore } from './workspaces.store';

export const WorkspaceListPage = (): JSX.Element => {
  const workspaces = useWorkspacesStore((storeState) => storeState.workspaces);
  const activeWorkspaceId = useWorkspacesStore((storeState) => storeState.activeWorkspaceId);
  const loading = useWorkspacesStore((storeState) => storeState.loading);
  const isCreateDialogOpen = useWorkspacesStore((storeState) => storeState.isCreateDialogOpen);
  const errorMessage = useWorkspacesStore((storeState) => storeState.errorMessage);

  useEffect(() => {
    void workspacesStore.loadWorkspaces();
  }, []);

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;

  return (
    <section data-testid="workspace-list-page">
      <h2 style={{ marginBottom: '8px' }}>Workspaces</h2>
      <p style={{ marginTop: 0, marginBottom: '16px' }}>
        Create, open, and delete registry-backed workspaces.
      </p>

      <div style={{ marginBottom: '16px' }}>
        <button
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

      {errorMessage ? (
        <p data-testid="workspace-error" style={{ color: '#b42318' }}>
          {errorMessage}
        </p>
      ) : null}

      <p data-testid="active-workspace-name" style={{ fontWeight: 600 }}>
        Active workspace: {activeWorkspace?.name ?? 'none'}
      </p>

      {workspaces.length === 0 ? (
        <p data-testid="workspace-empty">No workspaces yet.</p>
      ) : (
        <ul data-testid="workspace-list" style={{ padding: 0, listStyle: 'none' }}>
          {workspaces.map((workspace) => (
            <li
              key={workspace.id}
              data-testid={`workspace-row-${workspace.id}`}
              style={{
                border: '1px solid #d0d7e2',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '8px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <strong>{workspace.name}</strong>
                  <div style={{ color: '#475467', fontSize: '14px' }}>{workspace.rootDir}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    data-testid={`workspace-open-${workspace.id}`}
                    disabled={loading}
                    onClick={() => void workspacesStore.openWorkspace(workspace.id)}
                    type="button"
                  >
                    Open {workspace.name}
                  </button>
                  <button
                    data-testid={`workspace-delete-${workspace.id}`}
                    disabled={loading}
                    onClick={() => void workspacesStore.deleteWorkspace(workspace.id)}
                    type="button"
                  >
                    Delete {workspace.name}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
