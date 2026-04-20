import { WorkspaceCanvasPage } from './features/canvas/WorkspaceCanvasPage';
import { WorkbenchShell } from './features/workbench/WorkbenchShell';
import { WorkspaceListPage } from './features/workspaces/WorkspaceListPage';
import { useWorkspacesStore } from './features/workspaces/workspaces.store';

export const App = (): JSX.Element => {
  const workspaces = useWorkspacesStore((storeState) => storeState.workspaces);
  const activeWorkspaceId = useWorkspacesStore((storeState) => storeState.activeWorkspaceId);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;

  const stage = activeWorkspace ? (
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
  );

  return (
    <WorkbenchShell
      workspaceName={activeWorkspace?.name ?? null}
      workspaceRootDir={activeWorkspace?.rootDir ?? null}
      contextPanel={<WorkspaceListPage variant="panel" />}
      stage={stage}
    />
  );
};
