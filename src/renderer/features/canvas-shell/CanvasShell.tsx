import { useEffect, useMemo } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps
} from '@xyflow/react';
import type { GraphSnapshotV2Input } from '../../../shared/ipc/schemas';
import { renderBuiltinHost as BuiltinHostRenderer } from '../components/builtin-host-registry';
import { CanvasEmptyState } from './CanvasEmptyState';
import { CanvasSelectionHud } from './CanvasSelectionHud';

const DEFAULT_CANVAS_VIEWPORT = {
  x: 0,
  y: 0,
  zoom: 1
} as const;

interface CanvasShellNodeData {
  workspaceId: string;
  workspaceRootDir: string;
  node: GraphSnapshotV2Input['nodes'][number];
  onOpenRun: (runId: string) => void;
  onCreateBranchWorkspace: () => void;
}

type CanvasShellNode = Node<CanvasShellNodeData, 'builtinHost'>;

type CanvasShellModel = {
  nodes: CanvasShellNode[];
  edges: Edge[];
};

export interface ProjectGraphToCanvasShellInput {
  workspaceId: string;
  workspaceRootDir: string;
  graphSnapshot: GraphSnapshotV2Input;
  onOpenRun: (runId: string) => void;
  onCreateBranchWorkspace: () => void;
}

export interface CanvasShellProps extends ProjectGraphToCanvasShellInput {
  onOpenCommandPalette: () => void;
  onOpenQuickAdd: () => void;
  onSelectNode: (nodeId: string | null) => void;
  onMoveNode: (nodeId: string, position: { x: number; y: number }) => void;
  onAddTerminal: () => void;
  onAddNote: () => void;
  onAddPortal: () => void;
  onAddFileTree: () => void;
  onAddText: () => void;
}

const BuiltinHostFlowNode = ({ data }: NodeProps<CanvasShellNode>): JSX.Element => {
  return (
    <div
      className="nodrag nopan"
      data-testid={`canvas-shell-node-${data.node.id}`}
      style={{
        width: '100%',
        height: '100%',
        minWidth: 0,
        overflow: 'hidden'
      }}
    >
      <BuiltinHostRenderer
        workspaceId={data.workspaceId}
        workspaceRootDir={data.workspaceRootDir}
        node={data.node}
        onOpenRun={data.onOpenRun}
        onCreateBranchWorkspace={data.onCreateBranchWorkspace}
      />
    </div>
  );
};

const nodeTypes = {
  builtinHost: BuiltinHostFlowNode
};

export const projectGraphToCanvasShell = (
  input: ProjectGraphToCanvasShellInput
): CanvasShellModel => {
  return {
    nodes: input.graphSnapshot.nodes.map((node) => ({
      id: node.id,
      type: 'builtinHost',
      position: {
        x: node.bounds.x,
        y: node.bounds.y
      },
      data: {
        workspaceId: input.workspaceId,
        workspaceRootDir: input.workspaceRootDir,
        node,
        onOpenRun: input.onOpenRun,
        onCreateBranchWorkspace: input.onCreateBranchWorkspace
      },
      style: {
        width: node.bounds.width,
        height: node.bounds.height
      },
      draggable: true,
      selectable: true
    })),
    edges: input.graphSnapshot.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? undefined,
      targetHandle: edge.targetHandle ?? undefined,
      label: edge.label ?? undefined,
      data: edge.meta,
      type: 'smoothstep'
    }))
  };
};

export const CanvasShell = ({
  workspaceId,
  workspaceRootDir,
  graphSnapshot,
  onOpenCommandPalette,
  onOpenQuickAdd,
  onSelectNode,
  onOpenRun,
  onCreateBranchWorkspace,
  onMoveNode,
  onAddTerminal,
  onAddNote,
  onAddPortal,
  onAddFileTree,
  onAddText
}: CanvasShellProps): JSX.Element => {
  const model = useMemo(
    () =>
      projectGraphToCanvasShell({
        workspaceId,
        workspaceRootDir,
        graphSnapshot,
        onOpenRun,
        onCreateBranchWorkspace
      }),
    [graphSnapshot, onCreateBranchWorkspace, onOpenRun, workspaceId, workspaceRootDir]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(model.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(model.edges);
  const isEmpty = model.nodes.length === 0;

  useEffect(() => {
    setNodes(model.nodes);
  }, [model.nodes, setNodes]);

  useEffect(() => {
    setEdges(model.edges);
  }, [model.edges, setEdges]);

  return (
    <section className="ow-canvas-shell" data-testid="canvas-shell">
      <div className="ow-canvas-shell__header">
        <div>
          <p className="ow-canvas-shell__eyebrow">Infinite canvas</p>
          <h3>Blueprint canvas surface</h3>
        </div>
        <div className="ow-canvas-shell__actions">
          <button
            className="ow-toolbar-button"
            data-testid="command-palette-trigger"
            onClick={onOpenCommandPalette}
            type="button"
          >
            Command palette
          </button>
          <button
            className="ow-toolbar-button ow-toolbar-button--primary"
            data-testid="canvas-quick-add-trigger"
            onClick={onOpenQuickAdd}
            type="button"
          >
            Quick add
          </button>
          <div className="ow-canvas-shell__meta">Pan, zoom, connect, inspect</div>
        </div>
      </div>

      <CanvasSelectionHud edgeCount={model.edges.length} nodeCount={model.nodes.length} />

      <div className="ow-canvas-shell__flow" data-testid="canvas-shell-flow">
        <div className="ow-canvas-shell__grid" data-testid="canvas-shell-grid" />
        <ReactFlowProvider>
          <ReactFlow
            defaultViewport={DEFAULT_CANVAS_VIEWPORT}
            edges={edges}
            minZoom={0.4}
            nodeTypes={nodeTypes}
            nodes={nodes}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_event, node) => {
              onSelectNode(node.id);
            }}
            onNodeDragStop={(_event, node) => {
              onMoveNode(node.id, {
                x: node.position.x,
                y: node.position.y
              });
            }}
            onNodesChange={onNodesChange}
            onPaneClick={() => {
              onSelectNode(null);
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={24} size={1} />
            <div data-testid="canvas-shell-minimap">
              <MiniMap pannable zoomable style={{ pointerEvents: 'none' }} />
            </div>
            <Controls />
          </ReactFlow>
        </ReactFlowProvider>

        {isEmpty ? (
          <CanvasEmptyState
            actions={[
              { label: 'Terminal', hotkey: '1', onClick: onAddTerminal },
              { label: 'Note', hotkey: '2', onClick: onAddNote },
              { label: 'Portal', hotkey: '3', onClick: onAddPortal },
              { label: 'File tree', hotkey: '4', onClick: onAddFileTree },
              { label: 'Text', hotkey: '5', onClick: onAddText }
            ]}
          />
        ) : null}
      </div>
    </section>
  );
};
