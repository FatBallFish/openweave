import { WorkspaceCanvasPage } from './features/canvas/WorkspaceCanvasPage';
import { WorkspaceListPage } from './features/workspaces/WorkspaceListPage';
import { useWorkspacesStore } from './features/workspaces/workspaces.store';

export const App = (): JSX.Element => {
  const workspaces = useWorkspacesStore((storeState) => storeState.workspaces);
  const activeWorkspaceId = useWorkspacesStore((storeState) => storeState.activeWorkspaceId);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;

  return (
    <main className="ow-workbench-shell" data-testid="workbench-shell">
      <header className="ow-workbench-topbar" data-testid="workbench-topbar">
        <div className="ow-workbench-topbar__identity">
          <h1 className="ow-workbench-topbar__brand">OpenWeave</h1>
          <span className="ow-workbench-topbar__subtitle">AI engineer workbench</span>
        </div>
        <div className="ow-workbench-topbar__status">Workbench ready</div>
      </header>

      <div className="ow-workbench-body">
        <aside className="ow-workbench-sidebar" data-testid="workbench-sidebar">
          <WorkspaceListPage />
        </aside>

        <section className="ow-workbench-stage" data-testid="workbench-stage">
          {activeWorkspace ? (
            <WorkspaceCanvasPage
              workspaceId={activeWorkspace.id}
              workspaceName={activeWorkspace.name}
              workspaceRootDir={activeWorkspace.rootDir}
            />
          ) : (
            <div className="ow-workbench-stage__empty" data-testid="workbench-stage-empty">
              <div>
                <strong>Select or create a workspace</strong>
                Create or open a workspace to start composing workflows on the canvas.
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};
