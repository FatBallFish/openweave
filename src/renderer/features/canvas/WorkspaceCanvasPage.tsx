import { useCallback, useEffect, useState } from 'react';
import { CanvasShell } from '../canvas-shell/CanvasShell';
import { RunDrawer } from '../runs/RunDrawer';
import { workspacesStore } from '../workspaces/workspaces.store';
import { useCanvasStore, canvasStore } from './canvas.store';
import { NodeToolbar } from './nodes/NodeToolbar';

interface WorkspaceCanvasPageProps {
  workspaceId: string;
  workspaceName: string;
  workspaceRootDir: string;
  onOpenCommandPalette: () => void;
  onOpenQuickAdd: () => void;
  onSelectNode: (nodeId: string | null) => void;
}

export const WorkspaceCanvasPage = ({
  workspaceId,
  workspaceName,
  workspaceRootDir,
  onOpenCommandPalette,
  onOpenQuickAdd,
  onSelectNode
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

      <NodeToolbar />

      {errorMessage ? (
        <p className="ow-workspace-canvas-page__error" data-testid="canvas-error">
          {errorMessage}
        </p>
      ) : null}

      {loading ? (
        <p data-testid="canvas-loading">Loading canvas...</p>
      ) : (
        <CanvasShell
          workspaceId={workspaceId}
          workspaceRootDir={workspaceRootDir}
          graphSnapshot={graphSnapshot}
          onOpenCommandPalette={onOpenCommandPalette}
          onOpenQuickAdd={onOpenQuickAdd}
          onSelectNode={onSelectNode}
          onOpenRun={openRun}
          onCreateBranchWorkspace={openBranchDialog}
          onAddTerminal={() => {
            void canvasStore.addTerminalNode();
          }}
          onAddNote={() => {
            void canvasStore.addNoteNode();
          }}
          onAddPortal={() => {
            void canvasStore.addPortalNode();
          }}
          onAddFileTree={() => {
            void canvasStore.addFileTreeNode(workspaceRootDir);
          }}
          onAddText={() => {
            void canvasStore.addTextNode();
          }}
          onMoveNode={(nodeId, position) => {
            void canvasStore.updateNodePosition(nodeId, position);
          }}
        />
      )}

      <RunDrawer workspaceId={workspaceId} runId={activeRunId} onClose={() => setActiveRunId(null)} />
    </section>
  );
};
