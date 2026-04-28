import {
  JSX,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent
} from 'react';
import {
  Background,
  BackgroundVariant,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useOnViewportChange,
  useEdgesState,
  useNodesState,
  NodeResizer,
  type Edge,
  type Node,
  type NodeProps
} from '@xyflow/react';
import type { GraphSnapshotV2Input } from '../../../shared/ipc/schemas';
import { renderBuiltinHost as BuiltinHostRenderer } from '../components/builtin-host-registry';
import { canvasStore } from '../canvas/canvas.store';
import { CanvasEmptyState } from './CanvasEmptyState';
import { CanvasViewportControls } from './CanvasViewportControls';
import { computeSmartFitViewport } from './canvas-fit-view';
import { ConnectModeOverlay } from './ConnectModeOverlay';
import { ConnectEdge } from './edge-types/ConnectEdge';
import './edge-types/connect-edge.css';
import { getBuiltinComponentManifest } from '../../../shared/components/builtin-manifests';
import { MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM } from './canvas-viewport-limits';

const DEFAULT_CANVAS_VIEWPORT = {
  x: 0,
  y: 0,
  zoom: 1
} as const;

interface ConnectModeContextValue {
  active: boolean;
  sourceNodeId: string | null;
  onSelectSource: ((nodeId: string) => void) | undefined;
  onCompleteConnection: ((sourceId: string, targetId: string) => void) | undefined;
  graphSnapshot: GraphSnapshotV2Input;
}

const ConnectModeContext = createContext<ConnectModeContextValue>({
  active: false,
  sourceNodeId: null,
  onSelectSource: undefined,
  onCompleteConnection: undefined,
  graphSnapshot: { schemaVersion: 2, nodes: [], edges: [] }
});

interface CanvasShellNodeData {
  workspaceId: string;
  workspaceRootDir: string;
  node: GraphSnapshotV2Input['nodes'][number];
  onOpenRun: (runId: string) => void;
  onCreateBranchWorkspace: () => void;
  onResizeNode?: (nodeId: string, bounds: { x: number; y: number; width: number; height: number }) => void;
}

// @ts-ignore
type CanvasShellNode = Node<CanvasShellNodeData, 'builtinHost'>;

type CanvasShellModel = {
  nodes: CanvasShellNode[];
  edges: Edge[];
};

type ConnectorSide = 'left' | 'right' | 'top' | 'bottom';

export interface ProjectGraphToCanvasShellInput {
  workspaceId: string;
  workspaceRootDir: string;
  graphSnapshot: GraphSnapshotV2Input;
  onOpenRun: (runId: string) => void;
  onCreateBranchWorkspace: () => void;
  onResizeNode?: (nodeId: string, bounds: { x: number; y: number; width: number; height: number }) => void;
  activeEdgeIds?: string[];
  selectedEdgeId?: string | null;
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
  placementMode?: { type: string } | null;
  onPlacementComplete?: (type: string, bounds: { x: number; y: number; width: number; height: number }) => void;
  onPlacementCancel?: () => void;
  connectModeActive?: boolean;
  connectSourceNodeId?: string | null;
  activeEdgeIds?: string[];
  selectedEdgeId?: string | null;
  onSelectConnectSource?: (nodeId: string) => void;
  onCompleteConnection?: (sourceId: string, targetId: string) => void;
  onSelectEdge?: (edgeId: string | null) => void;
  onDeleteSelectedEdge?: () => void;
}

// @ts-ignore
const BuiltinHostFlowNode = ({ data, selected, id }: NodeProps<CanvasShellNode>): JSX.Element => {
  const connectMode = useContext(ConnectModeContext);
  const targetNode = connectMode.graphSnapshot.nodes.find((n) => n.id === id);
  const manifest = targetNode ? getBuiltinComponentManifest(targetNode.componentType) : null;
  const connectable = manifest?.node.connectable !== false;

  const handleConnectOverlayClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!connectMode.active || !connectable) return;
    if (!connectMode.sourceNodeId) {
      connectMode.onSelectSource?.(id);
    } else if (id !== connectMode.sourceNodeId) {
      connectMode.onCompleteConnection?.(connectMode.sourceNodeId, id);
    }
  }, [connectMode, connectable, id]);

  const handleConnectOverlayKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    if (!connectMode.active || !connectable) return;
    if (!connectMode.sourceNodeId) {
      connectMode.onSelectSource?.(id);
    } else if (id !== connectMode.sourceNodeId) {
      connectMode.onCompleteConnection?.(connectMode.sourceNodeId, id);
    }
  }, [connectMode, connectable, id]);

  const stopConnectOverlayPointer = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return (
    <div
      data-testid={`canvas-shell-node-${data.node.id}`}
      style={{
        width: '100%',
        height: '100%',
        minWidth: 0,
        overflow: 'hidden',
        position: 'relative'
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
      {connectionHandleSides.map((side) => (
        <Handle
          id={`source-${side}`}
          isConnectable={false}
          key={`source-${side}`}
          position={connectorSidePositions[side]}
          style={hiddenHandleStyle}
          type="source"
        />
      ))}
      {connectionHandleSides.map((side) => (
        <Handle
          id={`target-${side}`}
          isConnectable={false}
          key={`target-${side}`}
          position={connectorSidePositions[side]}
          style={hiddenHandleStyle}
          type="target"
        />
      ))}
      {connectMode.active && connectable ? (
        <div
          aria-label={`Connect ${data.node.title}`}
          className={`ow-canvas-connect-hit-mask${connectMode.sourceNodeId === id ? ' is-source' : ''}`}
          data-testid={`canvas-connect-hit-mask-${data.node.id}`}
          onClick={handleConnectOverlayClick}
          onKeyDown={handleConnectOverlayKeyDown}
          onPointerDown={stopConnectOverlayPointer}
          role="button"
          tabIndex={0}
        />
      ) : null}
    </div>
  );
};

const nodeTypes = {
  builtinHost: BuiltinHostFlowNode
};

const edgeTypes = {
  connectEdge: ConnectEdge
};

const hiddenHandleStyle = {
  width: 1,
  height: 1,
  minWidth: 1,
  minHeight: 1,
  border: 'none',
  background: 'transparent',
  opacity: 0,
  pointerEvents: 'none'
} as const;

const connectionHandleSides: ConnectorSide[] = ['left', 'right', 'top', 'bottom'];

const connectorSidePositions: Record<ConnectorSide, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom
};

const oppositeConnectorSide: Record<ConnectorSide, ConnectorSide> = {
  left: 'right',
  right: 'left',
  top: 'bottom',
  bottom: 'top'
};

const getBoundsCenter = (bounds: GraphSnapshotV2Input['nodes'][number]['bounds']): { x: number; y: number } => ({
  x: bounds.x + bounds.width / 2,
  y: bounds.y + bounds.height / 2
});

const chooseConnectorRoute = (
  sourceNode: GraphSnapshotV2Input['nodes'][number] | undefined,
  targetNode: GraphSnapshotV2Input['nodes'][number] | undefined
): { sourceSide: ConnectorSide; targetSide: ConnectorSide; sourcePosition: Position; targetPosition: Position } => {
  if (!sourceNode || !targetNode) {
    return {
      sourceSide: 'right',
      targetSide: 'left',
      sourcePosition: Position.Right,
      targetPosition: Position.Left
    };
  }

  const sourceCenter = getBoundsCenter(sourceNode.bounds);
  const targetCenter = getBoundsCenter(targetNode.bounds);
  const deltaX = targetCenter.x - sourceCenter.x;
  const deltaY = targetCenter.y - sourceCenter.y;
  const sourceSide: ConnectorSide = Math.abs(deltaX) >= Math.abs(deltaY)
    ? deltaX >= 0 ? 'right' : 'left'
    : deltaY >= 0 ? 'bottom' : 'top';
  const targetSide = oppositeConnectorSide[sourceSide];

  return {
    sourceSide,
    targetSide,
    sourcePosition: connectorSidePositions[sourceSide],
    targetPosition: connectorSidePositions[targetSide]
  };
};

const getHandlePoint = (
  bounds: GraphSnapshotV2Input['nodes'][number]['bounds'],
  side: ConnectorSide
): { x: number; y: number } => {
  switch (side) {
    case 'left':
      return { x: 0, y: bounds.height / 2 };
    case 'right':
      return { x: bounds.width, y: bounds.height / 2 };
    case 'top':
      return { x: bounds.width / 2, y: 0 };
    case 'bottom':
      return { x: bounds.width / 2, y: bounds.height };
    default:
      return { x: bounds.width, y: bounds.height / 2 };
  }
};

const createConnectionHandles = (
  bounds: GraphSnapshotV2Input['nodes'][number]['bounds']
): NonNullable<CanvasShellNode['handles']> =>
  connectionHandleSides.flatMap((side) => {
    const point = getHandlePoint(bounds, side);
    return [
      {
        id: `source-${side}`,
        type: 'source' as const,
        position: connectorSidePositions[side],
        x: point.x,
        y: point.y,
        width: 1,
        height: 1
      },
      {
        id: `target-${side}`,
        type: 'target' as const,
        position: connectorSidePositions[side],
        x: point.x,
        y: point.y,
        width: 1,
        height: 1
      }
    ];
  });

const classifyWheelEvent = (event: WheelEvent): 'pan' | 'zoom' => {
  // Pinch gesture (macOS Safari/Chrome sends ctrlKey + wheel)
  if (event.ctrlKey || event.metaKey) return 'zoom';
  // DOM_DELTA_LINE is a strong signal for mouse wheel
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return 'zoom';

  const absX = Math.abs(event.deltaX);
  const absY = Math.abs(event.deltaY);

  // Any horizontal movement strongly suggests trackpad pan
  // (mouse wheels rarely produce horizontal deltas)
  if (absX > 0.5) return 'pan';

  // Small pure-vertical movement also suggests trackpad slow scroll
  if (absY > 0 && absY < 20) return 'pan';

  // Large pure-vertical movement → mouse wheel zoom
  return 'zoom';
};

const isInsideNoWheelSurface = (event: Event): boolean => {
  if (typeof event.composedPath === 'function') {
    return event.composedPath().some(
      (target) => target instanceof Element && target.classList.contains('nowheel')
    );
  }

  return event.target instanceof Element && event.target.closest('.nowheel') !== null;
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
      if (isInsideNoWheelSurface(wheelEvent)) {
        return;
      }
      wheelEvent.preventDefault();

      const { x, y, zoom } = getViewport();
      const action = classifyWheelEvent(wheelEvent);

      if (action === 'zoom') {
        const rect = pane.getBoundingClientRect();
        const mouseX = wheelEvent.clientX - rect.left;
        const mouseY = wheelEvent.clientY - rect.top;
        const zoomFactor = wheelEvent.deltaY > 0 ? 0.92 : 1.08;
        const newZoom = Math.min(Math.max(zoom * zoomFactor, MIN_CANVAS_ZOOM), MAX_CANVAS_ZOOM);

        const worldX = (mouseX - x) / zoom;
        const worldY = (mouseY - y) / zoom;
        const newX = mouseX - worldX * newZoom;
        const newY = mouseY - worldY * newZoom;

        setViewport({ x: newX, y: newY, zoom: newZoom }, { duration: 0 });
      } else {
        setViewport(
          { x: x - wheelEvent.deltaX / zoom, y: y - wheelEvent.deltaY / zoom, zoom },
          { duration: 0 }
        );
      }
    };

    pane.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      pane.removeEventListener('wheel', handleWheel);
    };
  }, [getViewport, setViewport]);

  return null;
};

const CANVAS_VIEWPORT_STORAGE_KEY = 'openweave:canvas:viewport';

const getStoredViewport = (workspaceId: string): { x: number; y: number; zoom: number } | null => {
  try {
    const stored = localStorage.getItem(CANVAS_VIEWPORT_STORAGE_KEY);
    if (!stored) return null;
    const map = JSON.parse(stored) as Record<string, { x: number; y: number; zoom: number }>;
    return map[workspaceId] ?? null;
  } catch {
    return null;
  }
};

const setStoredViewport = (workspaceId: string, viewport: { x: number; y: number; zoom: number }): void => {
  try {
    const stored = localStorage.getItem(CANVAS_VIEWPORT_STORAGE_KEY);
    const map = stored ? (JSON.parse(stored) as Record<string, { x: number; y: number; zoom: number }>) : {};
    map[workspaceId] = viewport;
    localStorage.setItem(CANVAS_VIEWPORT_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
};

const CanvasViewportController = ({
  fitViewRequestId,
  nodesCount
}: {
  fitViewRequestId: number;
  nodesCount: number;
}): null => {
  const { getNodes, setViewport } = useReactFlow();
  const previousNodesCount = useRef(nodesCount);

  const applySmartFit = useCallback(() => {
    const container = document.querySelector('.ow-canvas-shell__flow');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const nodes = getNodes();
    const viewport = computeSmartFitViewport(nodes, rect.width, rect.height);

    if (viewport) {
      setViewport(viewport, { duration: 180 });
    }
  }, [getNodes, setViewport]);

  useEffect(() => {
    if (fitViewRequestId === 0) {
      return;
    }

    applySmartFit();
  }, [applySmartFit, fitViewRequestId]);

  useEffect(() => {
    const shouldFitNewNodes = nodesCount > previousNodesCount.current && nodesCount <= 6;
    previousNodesCount.current = nodesCount;

    if (!shouldFitNewNodes) {
      return;
    }

    const timeoutHandle = window.setTimeout(() => {
      applySmartFit();
    }, 48);

    return () => {
      window.clearTimeout(timeoutHandle);
    };
  }, [applySmartFit, nodesCount]);

  return null;
};

const ViewportPersistence = ({ workspaceId }: { workspaceId: string }): null => {
  const { getViewport, setViewport } = useReactFlow();
  const previousWorkspaceId = useRef(workspaceId);

  useEffect(() => {
    const prevId = previousWorkspaceId.current;
    if (prevId && prevId !== workspaceId) {
      // Save viewport for the workspace we're leaving
      setStoredViewport(prevId, getViewport());
    }
    previousWorkspaceId.current = workspaceId;
  }, [workspaceId, getViewport]);

  useEffect(() => {
    const restored = getStoredViewport(workspaceId);
    if (restored) {
      setViewport(restored, { duration: 0 });
    } else {
      setViewport(DEFAULT_CANVAS_VIEWPORT, { duration: 0 });
    }
  }, [workspaceId, setViewport]);

  return null;
};

const CanvasViewportBridge = (): null => {
  const { getViewport } = useReactFlow();

  const publishViewport = useCallback(() => {
    const container = document.querySelector('.ow-canvas-shell__flow');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    canvasStore.setCanvasViewport({
      ...getViewport(),
      width: rect.width,
      height: rect.height
    });
  }, [getViewport]);

  useOnViewportChange({
    onChange: publishViewport,
    onEnd: publishViewport
  });

  useEffect(() => {
    publishViewport();
    const container = document.querySelector('.ow-canvas-shell__flow');
    if (!container || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => publishViewport());
    observer.observe(container);
    return () => observer.disconnect();
  }, [publishViewport]);

  return null;
};

const CanvasMiniMap = (): JSX.Element => {
  const [expanded, setExpanded] = useState(false);
  const { getViewport, setViewport } = useReactFlow();

  const handleJump = useCallback(
    (_event: MouseEvent, position: { x: number; y: number }) => {
      const container = document.querySelector('.ow-canvas-shell__flow');
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const { zoom } = getViewport();
      setViewport(
        {
          x: rect.width / 2 - position.x * zoom,
          y: rect.height / 2 - position.y * zoom,
          zoom
        },
        { duration: 180 }
      );
    },
    [getViewport, setViewport]
  );

  if (!expanded) {
    return (
      <button
        aria-label="展开画布预览"
        className="ow-canvas-shell-minimap ow-canvas-shell-minimap--collapsed"
        data-testid="canvas-shell-minimap"
        onClick={() => setExpanded(true)}
        title="展开画布预览"
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
          <path d="M4 6h16M4 12h16M4 18h16M7 4v16M17 4v16" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
        </svg>
      </button>
    );
  }

  return (
    <div className="ow-canvas-shell-minimap ow-canvas-shell-minimap--expanded" data-testid="canvas-shell-minimap">
      <button
        aria-label="收起画布预览"
        className="ow-canvas-shell-minimap__collapse"
        data-testid="canvas-shell-minimap-collapse"
        onClick={() => setExpanded(false)}
        title="收起画布预览"
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16">
          <path d="M8 8h8v8H8z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      </button>
      <MiniMap
        ariaLabel="画布预览"
        bgColor="rgba(var(--ow-surface-rgb), 0.82)"
        className="ow-canvas-shell-minimap__map"
        maskColor="rgba(var(--ow-accent-rgb), 0.14)"
        maskStrokeColor="rgba(var(--ow-accent-rgb), 0.72)"
        maskStrokeWidth={2}
        nodeBorderRadius={4}
        nodeColor="rgba(var(--ow-accent-rgb), 0.18)"
        nodeStrokeColor="rgba(var(--ow-accent-rgb), 0.52)"
        nodeStrokeWidth={1.5}
        onClick={handleJump}
        pannable={true}
        zoomable={true}
      />
    </div>
  );
};

const PlacementOverlay = ({
  placementMode,
  onPlacementComplete,
  onPlacementCancel
}: {
  placementMode: { type: string };
  onPlacementComplete?: (type: string, bounds: { x: number; y: number; width: number; height: number }) => void;
  onPlacementCancel?: () => void;
}): JSX.Element => {
  const [placementRect, setPlacementRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const placementStartRef = useRef<{ x: number; y: number } | null>(null);
  const placementRectRef = useRef(placementRect);
  const { getViewport } = useReactFlow();

  useEffect(() => {
    placementRectRef.current = placementRect;
  }, [placementRect]);

  useEffect(() => {
    setPlacementRect(null);
    placementStartRef.current = null;
  }, [placementMode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onPlacementCancel?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onPlacementCancel]);

  return (
    <div
      className="ow-canvas-placement-overlay"
      data-testid="canvas-placement-overlay"
      onMouseDown={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const startX = e.clientX - rect.left;
        const startY = e.clientY - rect.top;
        placementStartRef.current = { x: startX, y: startY };
        setPlacementRect({ x: startX, y: startY, width: 0, height: 0 });
      }}
      onMouseMove={(e) => {
        if (!placementStartRef.current) {
          return;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        const startX = placementStartRef.current.x;
        const startY = placementStartRef.current.y;
        setPlacementRect({
          x: Math.min(startX, currentX),
          y: Math.min(startY, currentY),
          width: Math.abs(currentX - startX),
          height: Math.abs(currentY - startY)
        });
      }}
      onMouseUp={() => {
        const currentRect = placementRectRef.current;
        if (!placementStartRef.current || !currentRect) {
          placementStartRef.current = null;
          return;
        }
        const { x: vpX, y: vpY, zoom } = getViewport();
        const minSize = 60;
        const worldX = (currentRect.x - vpX) / zoom;
        const worldY = (currentRect.y - vpY) / zoom;
        const worldWidth = Math.max(currentRect.width / zoom, minSize);
        const worldHeight = Math.max(currentRect.height / zoom, minSize);

        onPlacementComplete?.(placementMode.type, {
          x: worldX,
          y: worldY,
          width: worldWidth,
          height: worldHeight
        });

        placementStartRef.current = null;
        setPlacementRect(null);
      }}
      onMouseLeave={() => {
        placementStartRef.current = null;
        setPlacementRect(null);
      }}
    >
      {placementRect ? (
        <div
          className="ow-canvas-placement-rect"
          style={{
            left: placementRect.x,
            top: placementRect.y,
            width: placementRect.width,
            height: placementRect.height
          }}
        />
      ) : null}
    </div>
  );
};

export const projectGraphToCanvasShell = (
  input: ProjectGraphToCanvasShellInput
): CanvasShellModel => {
  const graphNodeById = new Map(input.graphSnapshot.nodes.map((node) => [node.id, node]));

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
      handles: createConnectionHandles(node.bounds),
      draggable: true,
      selectable: true
    })),
    edges: input.graphSnapshot.edges.map((edge) => {
      const route = chooseConnectorRoute(graphNodeById.get(edge.source), graphNodeById.get(edge.target));
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: `source-${route.sourceSide}`,
        targetHandle: `target-${route.targetSide}`,
        label: edge.label ?? undefined,
        type: 'connectEdge',
        data: {
          ...(edge.meta ?? {}),
          route,
          isActive: input.activeEdgeIds?.includes(edge.id) ?? false
        },
        selected: input.selectedEdgeId === edge.id,
        selectable: true,
        deletable: true
      };
    })
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
  onAddText,
  placementMode,
  onPlacementComplete,
  onPlacementCancel,
  connectModeActive,
  connectSourceNodeId,
  activeEdgeIds,
  selectedEdgeId,
  onSelectConnectSource,
  onCompleteConnection,
  onSelectEdge,
  onDeleteSelectedEdge
}: CanvasShellProps): JSX.Element => {
  const model = useMemo(
    () =>
      projectGraphToCanvasShell({
        workspaceId,
        workspaceRootDir,
        graphSnapshot,
        onOpenRun,
        onCreateBranchWorkspace,
        onResizeNode,
        activeEdgeIds,
        selectedEdgeId
      }),
    [graphSnapshot, onCreateBranchWorkspace, onOpenRun, workspaceId, workspaceRootDir, onResizeNode, activeEdgeIds, selectedEdgeId]
  );
  // @ts-ignore
  const [nodes, setNodes, onNodesChange] = useNodesState(model.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(model.edges);
  const [emptyStateDismissed, setEmptyStateDismissed] = useState(false);
  const isEmpty = model.nodes.length === 0 && !emptyStateDismissed;

  useEffect(() => {
    // @ts-ignore
    setNodes(model.nodes);
  }, [model.nodes, setNodes]);

  useEffect(() => {
    if (model.nodes.length > 0) {
      setEmptyStateDismissed(false);
    }
  }, [model.nodes.length]);

  useEffect(() => {
    setEdges(model.edges);
  }, [model.edges, setEdges]);

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      const removeChanges = changes.filter(
        (change): change is { type: 'remove'; id: string } => change.type === 'remove'
      );
      if (removeChanges.length > 0) {
        const nodeIdsToRemove = removeChanges.map((change) => change.id);
        void canvasStore.deleteNodes(nodeIdsToRemove);
        // Do NOT pass remove changes to onNodesChange; the store update will re-sync nodes
        const otherChanges = changes.filter((change) => change.type !== 'remove');
        if (otherChanges.length > 0) {
          onNodesChange(otherChanges);
        }
        return;
      }
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  const connectModeContextValue = useMemo(
    () => ({
      active: connectModeActive ?? false,
      sourceNodeId: connectSourceNodeId ?? null,
      onSelectSource: onSelectConnectSource,
      onCompleteConnection,
      graphSnapshot
    }),
    [connectModeActive, connectSourceNodeId, onSelectConnectSource, onCompleteConnection, graphSnapshot]
  );

  return (
    <section className="ow-canvas-shell" data-testid="canvas-shell">
      <ConnectModeContext.Provider value={connectModeContextValue}>
        <ReactFlowProvider>
          <div className="ow-canvas-shell__flow" data-testid="canvas-shell-flow">
            <ReactFlow
              defaultViewport={DEFAULT_CANVAS_VIEWPORT}
              edges={edges}
              edgeTypes={edgeTypes}
              elementsSelectable={true}
              minZoom={MIN_CANVAS_ZOOM}
              maxZoom={MAX_CANVAS_ZOOM}
              nodeTypes={nodeTypes}
              nodes={nodes}
              onEdgesChange={onEdgesChange}
              onEdgeClick={(_event, edge) => {
                onSelectEdge?.(edge.id);
                onSelectNode(null);
              }}
              onEdgesDelete={(edges) => {
                if (edges.length > 0) {
                  onSelectEdge?.(edges[0].id);
                  onDeleteSelectedEdge?.();
                }
              }}
              nodesDraggable={!connectModeActive}
              onNodeClick={(_event, node) => {
                if (connectModeActive) {
                  // Connect mode is handled by the node hit mask so embedded hosts cannot swallow clicks.
                  return;
                }
                onSelectNode(node.id);
              }}
              onNodeDragStop={(_event, node) => {
                onMoveNode(node.id, {
                  x: node.position.x,
                  y: node.position.y
                });
              }}
              onNodesChange={handleNodesChange}
              onPaneClick={() => {
                onSelectNode(null);
              }}
              panOnDrag={true}
              proOptions={{ hideAttribution: true }}
              selectionOnDrag={true}
              zoomOnDoubleClick={false}
              zoomOnPinch={false}
              zoomOnScroll={false}
            >
              <CanvasViewportController fitViewRequestId={fitViewRequestId} nodesCount={nodes.length} />
              <ViewportPersistence workspaceId={workspaceId} />
              <CanvasViewportBridge />
              <WheelHandler />
              <Background gap={32} variant={BackgroundVariant.Lines} />
              {placementMode ? (
                <PlacementOverlay
                  placementMode={placementMode}
                  onPlacementComplete={onPlacementComplete}
                  onPlacementCancel={onPlacementCancel}
                />
              ) : null}
              {connectModeActive ? (
                <ConnectModeOverlay
                  sourceNodeId={connectSourceNodeId ?? null}
                  graphNodes={graphSnapshot.nodes}
                />
              ) : null}
              <CanvasMiniMap />
            </ReactFlow>

            {isEmpty ? (
              <CanvasEmptyState
                actions={[
                  { label: 'Terminal', hotkey: '1', onClick: onAddTerminal },
                  { label: 'Note', hotkey: '2', onClick: onAddNote },
                  { label: 'Portal', hotkey: '3', onClick: onAddPortal },
                  { label: 'File tree', hotkey: '4', onClick: onAddFileTree },
                  { label: 'Text', hotkey: '5', onClick: onAddText }
                ]}
                onClose={() => setEmptyStateDismissed(true)}
              />
            ) : null}
            <CanvasViewportControls />
          </div>
        </ReactFlowProvider>
      </ConnectModeContext.Provider>
    </section>
  );
};
