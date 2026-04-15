import { useEffect, useState } from 'react';
import { useCanvasStore, canvasStore } from './canvas.store';
import { NoteNode } from './nodes/NoteNode';
import { NodeToolbar } from './nodes/NodeToolbar';
import { TerminalNode } from './nodes/TerminalNode';
import { RunDrawer } from '../runs/RunDrawer';

interface WorkspaceCanvasPageProps {
  workspaceId: string;
  workspaceName: string;
}

export const WorkspaceCanvasPage = ({
  workspaceId,
  workspaceName
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
          {nodes.map((node) => (
            node.type === 'note' ? (
              <NoteNode
                key={node.id}
                node={node}
                onChange={(patch) => void canvasStore.updateNoteNode(node.id, patch)}
              />
            ) : (
              <TerminalNode
                key={node.id}
                workspaceId={workspaceId}
                node={node}
                onChange={(patch) => void canvasStore.updateTerminalNode(node.id, patch)}
                onOpenRun={(runId) => setActiveRunId(runId)}
              />
            )
          ))}
        </div>
      )}

      <RunDrawer runId={activeRunId} onClose={() => setActiveRunId(null)} />
    </section>
  );
};
