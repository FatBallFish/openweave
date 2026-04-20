import { canvasStore, useCanvasStore } from './features/canvas/canvas.store';
import { WorkspaceCanvasPage } from './features/canvas/WorkspaceCanvasPage';
import { WorkbenchShell } from './features/workbench/WorkbenchShell';
import { WorkspaceListPage } from './features/workspaces/WorkspaceListPage';
import { useWorkspacesStore } from './features/workspaces/workspaces.store';

export const App = (): JSX.Element => {
  const workspaces = useWorkspacesStore((storeState) => storeState.workspaces);
  const activeWorkspaceId = useWorkspacesStore((storeState) => storeState.activeWorkspaceId);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
  const canvasLoading = useCanvasStore((storeState) => storeState.loading);
  const disabled = activeWorkspace === null || canvasLoading;

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
      contextPanel={<WorkspaceListPage variant="panel" />}
      commandMenuDisabled={true}
      searchDisabled={true}
      disabled={disabled}
      fitViewDisabled={true}
      onAddTerminal={() => void canvasStore.addTerminalNode()}
      onAddNote={() => void canvasStore.addNoteNode()}
      onAddPortal={() => void canvasStore.addPortalNode()}
      onAddFileTree={() => void canvasStore.addFileTreeNode(activeWorkspace?.rootDir ?? '')}
      onAddText={() => void canvasStore.addTextNode()}
      onOpenCommandMenu={() => undefined}
      onFitCanvas={() => undefined}
      onOpenSettings={() => undefined}
      settingsDisabled={true}
      stage={stage}
      workspaceName={activeWorkspace?.name ?? null}
      workspaceRootDir={activeWorkspace?.rootDir ?? null}
    />
  );
};
