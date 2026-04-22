import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useEdgesState,
  useNodesState,
  NodeResizer,
  type Edge,
  type Node,
  type NodeProps
} from '@xyflow/react';
import type { GraphSnapshotV2Input } from '../../../shared/ipc/schemas';
import { renderBuiltinHost as BuiltinHostRenderer } from '../components/builtin-host-registry';
import { CanvasEmptyState } from './CanvasEmptyState';
import { NodeToolbar } from '../canvas/nodes/NodeToolbar';

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
  onResizeNode?: (nodeId: string, bounds: { x: number; y: number; width: number; height: number }) => void;
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
  onResizeNode?: (nodeId: string, bounds: { x: number; y: number; width: number; height: number }) => void;
}

export interface CanvasShellProps extends ProjectGraphToCanvasShellInput {
  fitViewRequestId: number;
  onOpenCommandPalette: () => void;
  onOpenQuickAdd: () => void;
  onSelectNode: (nodeId: string | null) => void;
  onMoveNode: (nodeId: string, position: { x: number; y: number }) => void;
  onResizeNode: (nodeId: string, bounds: { x: number; y: number; width: number; height: number }) => void;
  onAddTerminal: () => void;
  onAddNote: () => void;
  onAddPortal: () => void;
  onAddFileTree: () => void;
  onAddText: () => void;
}

const BuiltinHostFlowNode = ({ data, selected }: NodeProps<CanvasShellNode>): JSX.Element => {
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
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={80}
        handleClassName="ow-node-resizer__handle"
        lineClassName="ow-node-resizer__line"
        onResizeEnd={(_event, params) => {
          data.onResizeNode?.(data.node.id, {
            x: params.x,
            y: params.y,
            width: params.width,
            height: params.height
          });
        }}
      />
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

const WheelHandler = (): null => {
  const { getViewport, setViewport } = useReactFlow();

  useEffect(() => {
    const pane = document.querySelector('.ow-canvas-shell__flow .react-flow__pane');
    if (!pane) {
      return;
    }

    const handleWheel = (event: Event) => {
      const wheelEvent = event as WheelEvent;
      wheelEvent.preventDefault();

      const { x, y, zoom } = getViewport();
      const rect = pane.getBoundingClientRect();

      if (wheelEvent.ctrlKey || wheelEvent.metaKey) {
        // Trackpad pinch → zoom
        const delta = wheelEvent.deltaY > 0 ? -0.08 : 0.08;
        const newZoom = Math.min(Math.max(zoom + delta, 0.4), 2);
        setViewport({ x, y, zoom: newZoom }, { duration: 0 });
      } else if (Math.abs(wheelEvent.deltaX) > 0.5 && Math.abs(wheelEvent.deltaY) > 0.5) {
        // Trackpad two-finger pan → pan
        setViewport(
          { x: x - wheelEvent.deltaX / zoom, y: y - wheelEvent.deltaY / zoom, zoom },
          { duration: 0 }
        );
      } else {
        // Mouse wheel → zoom centered on cursor
        const mouseX = wheelEvent.clientX - rect.left;
        const mouseY = wheelEvent.clientY - rect.top;
        const zoomFactor = wheelEvent.deltaY > 0 ? 0.92 : 1.08;
        const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.4), 2);

        const worldX = (mouseX - x) / zoom;
        const worldY = (mouseY - y) / zoom;
        const newX = mouseX - worldX * newZoom;
        const newY = mouseY - worldY * newZoom;

        setViewport({ x: newX, y: newY, zoom: newZoom }, { duration: 0 });
      }
    };

    pane.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      pane.removeEventListener('wheel', handleWheel);
    };
  }, [getViewport, setViewport]);

  return null;
};

const CanvasViewportController = ({
  fitViewRequestId,
  nodesCount
}: {
  fitViewRequestId: number;
  nodesCount: number;
}): null => {
  const { fitView } = useReactFlow();
  const previousNodesCount = useRef(nodesCount);

  useEffect(() => {
    if (fitViewRequestId === 0) {
      return;
    }

    void fitView({
      duration: 180,
      padding: 0.3
    });
  }, [fitView, fitViewRequestId]);

  useEffect(() => {
    const shouldFitNewNodes = nodesCount > previousNodesCount.current && nodesCount <= 6;
    previousNodesCount.current = nodesCount;

    if (!shouldFitNewNodes) {
      return;
    }

    const timeoutHandle = window.setTimeout(() => {
      void fitView({
        duration: 180,
        padding: 0.36
      });
    }, 48);

    return () => {
      window.clearTimeout(timeoutHandle);
    };
  }, [fitView, nodesCount]);

  return null;
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
        onCreateBranchWorkspace: input.onCreateBranchWorkspace,
        onResizeNode: input.onResizeNode
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
  fitViewRequestId,
  workspaceId,
  workspaceRootDir,
  graphSnapshot,
  onOpenCommandPalette,
  onOpenQuickAdd,
  onSelectNode,
  onOpenRun,
  onCreateBranchWorkspace,
  onMoveNode,
  onResizeNode,
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
        onCreateBranchWorkspace,
        onResizeNode
      }),
    [graphSnapshot, onCreateBranchWorkspace, onOpenRun, workspaceId, workspaceRootDir, onResizeNode]
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
      <div className="ow-canvas-shell__flow" data-testid="canvas-shell-flow">
        <ReactFlowProvider>
          <ReactFlow
            defaultViewport={DEFAULT_CANVAS_VIEWPORT}
            edges={edges}
            elementsSelectable={true}
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
            panOnDrag={true}
            proOptions={{ hideAttribution: true }}
            selectionOnDrag={false}
            zoomOnDoubleClick={false}
            zoomOnPinch={false}
            zoomOnScroll={false}
          >
            <CanvasViewportController fitViewRequestId={fitViewRequestId} nodesCount={nodes.length} />
            <WheelHandler />
            <Background gap={24} variant={BackgroundVariant.Lines} color="rgba(var(--ow-accent-rgb), 0.25)" />
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
        <NodeToolbar />
      </div>
    </section>
  );
};
