import { useEffect } from 'react';
import { useCanvasStore, canvasStore } from './canvas.store';
import { NoteNode } from './nodes/NoteNode';
import { NodeToolbar } from './nodes/NodeToolbar';

interface WorkspaceCanvasPageProps {
  workspaceId: string;
  workspaceName: string;
}

export const WorkspaceCanvasPage = ({
  workspaceId,
  workspaceName
}: WorkspaceCanvasPageProps): JSX.Element => {
  const nodes = useCanvasStore((storeState) => storeState.nodes);
  const loading = useCanvasStore((storeState) => storeState.loading);
  const errorMessage = useCanvasStore((storeState) => storeState.errorMessage);

  useEffect(() => {
    void canvasStore.loadCanvasState(workspaceId);
  }, [workspaceId]);

  return (
    <section data-testid="workspace-canvas-page" style={{ marginTop: '24px' }}>
      <h2 style={{ marginBottom: '8px' }}>Workspace Canvas</h2>
      <p data-testid="canvas-workspace-name" style={{ marginTop: 0, marginBottom: '12px' }}>
        Canvas workspace: {workspaceName}
      </p>

      <NodeToolbar disabled={loading} onAddNote={() => void canvasStore.addNoteNode()} />

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
          {nodes.map((node) => (
            <NoteNode
              key={node.id}
              node={node}
              onChange={(patch) => void canvasStore.updateNoteNode(node.id, patch)}
            />
          ))}
        </div>
      )}
    </section>
  );
};
