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
import { renderBuiltinHost as BuiltinHostRenderer } from '../components/builtin-host-registry';
import type { GraphSnapshotV2Input } from '../../../shared/ipc/schemas';

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
  onMoveNode: (nodeId: string, position: { x: number; y: number }) => void;
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
  onOpenRun,
  onCreateBranchWorkspace,
  onMoveNode
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

  useEffect(() => {
    setNodes(model.nodes);
  }, [model.nodes, setNodes]);

  useEffect(() => {
    setEdges(model.edges);
  }, [model.edges, setEdges]);

  return (
    <section data-testid="canvas-shell" style={{ marginTop: '12px' }}>
      <div
        data-testid="canvas-shell-flow"
        style={{
          height: '720px',
          border: '1px solid #d0d5dd',
          borderRadius: '12px',
          overflow: 'hidden',
          background:
            'radial-gradient(circle at top left, rgba(82, 139, 255, 0.08), transparent 28%), #f8fafc'
        }}
      >
        <ReactFlowProvider>
          <ReactFlow
            defaultViewport={DEFAULT_CANVAS_VIEWPORT}
            edges={edges}
            minZoom={0.4}
            nodeTypes={nodeTypes}
            nodes={nodes}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={(_event, node) => {
              onMoveNode(node.id, {
                x: node.position.x,
                y: node.position.y
              });
            }}
            onNodesChange={onNodesChange}
          >
            <Background gap={24} size={1} />
            <MiniMap pannable zoomable />
            <Controls />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </section>
  );
};
