import { useCallback, useEffect, useState } from 'react';
import { CanvasShell } from '../canvas-shell/CanvasShell';
import { RunDrawer } from '../runs/RunDrawer';
import { workspacesStore } from '../workspaces/workspaces.store';
import { useCanvasStore, canvasStore } from './canvas.store';
import { useI18n } from '../../i18n/provider';

interface WorkspaceCanvasPageProps {
  fitViewRequestId: number;
  workspaceId: string;
  workspaceName: string;
  workspaceRootDir: string;
  onOpenCommandPalette: () => void;
  onOpenQuickAdd: () => void;
  onSelectNode: (nodeId: string | null) => void;
  onAddTerminal: () => void;
  placementMode?: { type: string } | null;
  onPlacementComplete?: (type: string, bounds: { x: number; y: number; width: number; height: number }) => void;
  onPlacementCancel?: () => void;
}

export const WorkspaceCanvasPage = ({
  fitViewRequestId,
  workspaceId,
  workspaceName,
  workspaceRootDir,
  onOpenCommandPalette,
  onOpenQuickAdd,
  onSelectNode,
  onAddTerminal,
  placementMode,
  onPlacementComplete,
  onPlacementCancel
}: WorkspaceCanvasPageProps): JSX.Element => {
  const { t } = useI18n();
  const [activeRun, setActiveRun] = useState<{ workspaceId: string; runId: string } | null>(null);
  const graphSnapshot = useCanvasStore((storeState) => storeState.graphSnapshot);
  const loading = useCanvasStore((storeState) => storeState.loading);
  const errorMessage = useCanvasStore((storeState) => storeState.errorMessage);
  const openRun = useCallback((runId: string) => {
    setActiveRun({ workspaceId, runId });
  }, [workspaceId]);
  const openBranchDialog = useCallback(() => {
    workspacesStore.openBranchDialog(workspaceId);
  }, [workspaceId]);
  const resizeNode = useCallback((nodeId: string, bounds: { x: number; y: number; width: number; height: number }) => {
    void canvasStore.updateNodeBounds(nodeId, bounds);
  }, []);

  useEffect(() => {
    void canvasStore.loadCanvasState(workspaceId);
    setActiveRun(null);
  }, [workspaceId]);

  return (
    <section className="ow-workspace-canvas-page" data-testid="workspace-canvas-page">
      {errorMessage ? (
        <p className="ow-workspace-canvas-page__error" data-testid="canvas-error">
          {errorMessage}
        </p>
      ) : null}

      {loading ? (
        <p data-testid="canvas-loading">{t('canvas.loading')}</p>
      ) : (
        <CanvasShell
          fitViewRequestId={fitViewRequestId}
          workspaceId={workspaceId}
          workspaceRootDir={workspaceRootDir}
          graphSnapshot={graphSnapshot}
          onOpenCommandPalette={onOpenCommandPalette}
          onOpenQuickAdd={onOpenQuickAdd}
          onSelectNode={onSelectNode}
          onOpenRun={openRun}
          onCreateBranchWorkspace={openBranchDialog}
          onAddTerminal={onAddTerminal}
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
          onResizeNode={resizeNode}
          placementMode={placementMode}
          onPlacementComplete={onPlacementComplete}
          onPlacementCancel={onPlacementCancel}
        />
      )}

      <span data-testid="canvas-workspace-name" hidden={true}>
        {workspaceName}
      </span>

      <RunDrawer
        workspaceId={workspaceId}
        runId={activeRun?.workspaceId === workspaceId ? activeRun.runId : null}
        onClose={() => setActiveRun(null)}
      />
    </section>
  );
};
