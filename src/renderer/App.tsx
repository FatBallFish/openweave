import { WorkspaceCanvasPage } from './features/canvas/WorkspaceCanvasPage';
import { WorkspaceListPage } from './features/workspaces/WorkspaceListPage';
import { useWorkspacesStore } from './features/workspaces/workspaces.store';

export const App = (): JSX.Element => {
  const workspaces = useWorkspacesStore((storeState) => storeState.workspaces);
  const activeWorkspaceId = useWorkspacesStore((storeState) => storeState.activeWorkspaceId);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;

  return (
    <main
      style={{
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
        margin: '48px auto',
        maxWidth: '860px',
        lineHeight: 1.4
      }}
    >
      <h1 data-testid="app-shell-title">OpenWeave</h1>
      <p data-testid="app-shell-subtitle">Electron shell ready for MVP tasks.</p>
      <WorkspaceListPage />
      {activeWorkspace ? (
        <WorkspaceCanvasPage workspaceId={activeWorkspace.id} workspaceName={activeWorkspace.name} />
      ) : null}
    </main>
  );
};
