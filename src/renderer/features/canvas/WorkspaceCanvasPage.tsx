import { useCallback, useEffect, useState } from 'react';
import { useCanvasStore, canvasStore } from './canvas.store';
import { NodeToolbar } from './nodes/NodeToolbar';
import { RunDrawer } from '../runs/RunDrawer';
import { workspacesStore } from '../workspaces/workspaces.store';
import { CanvasShell } from '../canvas-shell/CanvasShell';

interface WorkspaceCanvasPageProps {
  workspaceId: string;
  workspaceName: string;
  workspaceRootDir: string;
}

export const WorkspaceCanvasPage = ({
  workspaceId,
  workspaceName,
  workspaceRootDir
}: WorkspaceCanvasPageProps): JSX.Element => {
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const graphSnapshot = useCanvasStore((storeState) => storeState.graphSnapshot);
  const loading = useCanvasStore((storeState) => storeState.loading);
  const errorMessage = useCanvasStore((storeState) => storeState.errorMessage);
  const openRun = useCallback((runId: string) => {
    setActiveRunId(runId);
  }, []);
  const openBranchDialog = useCallback(() => {
    workspacesStore.openBranchDialog(workspaceId);
  }, [workspaceId]);

  useEffect(() => {
    void canvasStore.loadCanvasState(workspaceId);
    setActiveRunId(null);
  }, [workspaceId]);

  return (
    <section className="ow-workspace-canvas-page" data-testid="workspace-canvas-page">
      <header className="ow-workspace-canvas-page__header">
        <div>
          <p className="ow-workspace-canvas-page__eyebrow">Infinite canvas</p>
          <h2 data-testid="canvas-workspace-name">{workspaceName}</h2>
        </div>
        <div className="ow-workspace-canvas-page__meta">Graph schema v2 workspace</div>
      </header>

      <NodeToolbar
        disabled={loading}
        onAddNote={() => void canvasStore.addNoteNode()}
        onAddTerminal={() => void canvasStore.addTerminalNode()}
        onAddFileTree={() => void canvasStore.addFileTreeNode(workspaceRootDir)}
        onAddPortal={() => void canvasStore.addPortalNode()}
      />

      {errorMessage ? (
        <p className="ow-workspace-canvas-page__error" data-testid="canvas-error">
          {errorMessage}
        </p>
      ) : null}

      {loading ? (
        <p data-testid="canvas-loading">Loading canvas...</p>
      ) : graphSnapshot.nodes.length === 0 ? (
        <p data-testid="canvas-empty">No nodes yet.</p>
      ) : (
        <CanvasShell
          workspaceId={workspaceId}
          workspaceRootDir={workspaceRootDir}
          graphSnapshot={graphSnapshot}
          onOpenRun={openRun}
          onCreateBranchWorkspace={openBranchDialog}
          onMoveNode={(nodeId, position) => {
            void canvasStore.updateNodePosition(nodeId, position);
          }}
        />
      )}

      <RunDrawer workspaceId={workspaceId} runId={activeRunId} onClose={() => setActiveRunId(null)} />
    </section>
  );
};
