import { useEffect, useState } from 'react';
import { useCanvasStore, canvasStore } from './canvas.store';
import { FileTreeNode } from './nodes/FileTreeNode';
import { NoteNode } from './nodes/NoteNode';
import { NodeToolbar } from './nodes/NodeToolbar';
import { PortalNode } from './nodes/PortalNode';
import { TerminalNode } from './nodes/TerminalNode';
import { RunDrawer } from '../runs/RunDrawer';

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
  const nodes = useCanvasStore((storeState) => storeState.nodes);
  const loading = useCanvasStore((storeState) => storeState.loading);
  const errorMessage = useCanvasStore((storeState) => storeState.errorMessage);

  useEffect(() => {
    void canvasStore.loadCanvasState(workspaceId);
    setActiveRunId(null);
  }, [workspaceId]);

  return (
    <section data-testid="workspace-canvas-page" style={{ marginTop: '24px' }}>
      <h2 style={{ marginBottom: '8px' }}>Workspace Canvas</h2>
      <p data-testid="canvas-workspace-name" style={{ marginTop: 0, marginBottom: '12px' }}>
        Canvas workspace: {workspaceName}
      </p>

      <NodeToolbar
        disabled={loading}
        onAddNote={() => void canvasStore.addNoteNode()}
        onAddTerminal={() => void canvasStore.addTerminalNode()}
        onAddFileTree={() => void canvasStore.addFileTreeNode(workspaceRootDir)}
        onAddPortal={() => void canvasStore.addPortalNode()}
      />

      {errorMessage ? (
        <p data-testid="canvas-error" style={{ color: '#b42318' }}>
          {errorMessage}
        </p>
      ) : null}

      {loading ? (
        <p data-testid="canvas-loading">Loading canvas...</p>
      ) : nodes.length === 0 ? (
        <p data-testid="canvas-empty">No nodes yet.</p>
      ) : (
        <div data-testid="canvas-node-list" style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
          {nodes.map((node) =>
            node.type === 'note' ? (
              <NoteNode
                key={node.id}
                node={node}
                onChange={(patch) => void canvasStore.updateNoteNode(node.id, patch)}
              />
            ) : node.type === 'terminal' ? (
              <TerminalNode
                key={node.id}
                workspaceId={workspaceId}
                node={node}
                onChange={(patch) => void canvasStore.updateTerminalNode(node.id, patch)}
                onOpenRun={(runId) => setActiveRunId(runId)}
              />
            ) : node.type === 'file-tree' ? (
              <FileTreeNode
                key={node.id}
                workspaceId={workspaceId}
                node={node}
                onChange={(patch) => void canvasStore.updateFileTreeNode(node.id, patch)}
              />
            ) : (
              <PortalNode
                key={node.id}
                workspaceId={workspaceId}
                node={node}
                onChange={(patch) => void canvasStore.updatePortalNode(node.id, patch)}
              />
            )
          )}
        </div>
      )}

      <RunDrawer workspaceId={workspaceId} runId={activeRunId} onClose={() => setActiveRunId(null)} />
    </section>
  );
};
