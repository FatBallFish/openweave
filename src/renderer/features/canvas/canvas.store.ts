import { useSyncExternalStore } from 'react';
import type { OpenWeaveShellBridge } from '../../../shared/ipc/contracts';
import { getBuiltinComponentManifest } from '../../../shared/components/builtin-manifests';
import type {
  CanvasNodeInput,
  FileTreeNodeInput,
  GraphEdgeV2Input,
  GraphSnapshotV2Input,
  NoteNodeInput,
  PortalNodeInput,
  RunRuntimeInput,
  TerminalNodeInput
} from '../../../shared/ipc/schemas';
import { historyStore } from './history.store';

interface CanvasState {
  workspaceId: string | null;
  graphSnapshot: GraphSnapshotV2Input;
  nodes: CanvasNodeInput[];
  canvasViewport: CanvasViewport | null;
  selectedNodeId: string | null;
  connectModeActive: boolean;
  connectSourceNodeId: string | null;
  activeEdgeIds: string[];
  selectedEdgeId: string | null;
  recentAction: string | null;
  loading: boolean;
  errorMessage: string | null;
}

const emptyGraphSnapshot = (): GraphSnapshotV2Input => ({
  schemaVersion: 2,
  nodes: [],
  edges: []
});

const initialState: CanvasState = {
  workspaceId: null,
  graphSnapshot: emptyGraphSnapshot(),
  nodes: [],
  canvasViewport: null,
  selectedNodeId: null,
  connectModeActive: false,
  connectSourceNodeId: null,
  activeEdgeIds: [],
  selectedEdgeId: null,
  recentAction: null,
  loading: false,
  errorMessage: null
};

type StateListener = () => void;
type GraphNodeRecord = GraphSnapshotV2Input['nodes'][number];
type GraphEdgeRecord = GraphEdgeV2Input;
type CanvasViewport = {
  x: number;
  y: number;
  zoom: number;
  width: number;
  height: number;
};
const supportedRuntimes: RunRuntimeInput[] = ['shell', 'codex', 'claude', 'opencode'];
const starterSlotColumns = 4;
const starterSlotRows = 4;
const starterSlotOrigin = { x: 96, y: 96 };
const starterSlotGap = { x: 56, y: 56 };
const viewportPlacementMargin = 72;

let state: CanvasState = initialState;
const listeners = new Set<StateListener>();
let latestLoadRequestId = 0;
let latestRefreshRequestId = 0;
let latestSaveRequestId = 0;

const setState = (nextState: Partial<CanvasState>): void => {
  state = { ...state, ...nextState };
  for (const listener of listeners) {
    listener();
  }
};

const getBridge = (): OpenWeaveShellBridge['graph'] => {
  const shell = (window as Window & { openweaveShell?: OpenWeaveShellBridge }).openweaveShell;
  if (!shell) {
    throw new Error('openweaveShell bridge is unavailable');
  }
  return shell.graph;
};

const getShellBridge = (): OpenWeaveShellBridge | null => {
  return (window as Window & { openweaveShell?: OpenWeaveShellBridge }).openweaveShell ?? null;
};

const createNodeId = (prefix: string): string => {
  const fallbackId = `${prefix}-${Date.now()}`;
  const generatedId =
    typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : fallbackId;
  return `${prefix}-${generatedId}`;
};

const getRequiredBuiltinManifest = (componentType: string) => {
  const manifest = getBuiltinComponentManifest(componentType);
  if (!manifest) {
    throw new Error(`Missing builtin manifest: ${componentType}`);
  }
  return manifest;
};

const getRuntimeOrDefault = (value: unknown): RunRuntimeInput => {
  return supportedRuntimes.includes(value as RunRuntimeInput) ? (value as RunRuntimeInput) : 'shell';
};

const getRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

const rectanglesOverlap = (
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number }
): boolean => {
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
};

const getVisibleViewportBounds = (
  viewport: CanvasViewport
): { left: number; top: number; width: number; height: number; centerX: number; centerY: number } => {
  const width = viewport.width / viewport.zoom;
  const height = viewport.height / viewport.zoom;
  const left = -viewport.x / viewport.zoom;
  const top = -viewport.y / viewport.zoom;
  return {
    left,
    top,
    width,
    height,
    centerX: left + width / 2,
    centerY: top + height / 2
  };
};

const clampToVisibleViewport = (
  bounds: GraphNodeRecord['bounds'],
  viewport: CanvasViewport
): GraphNodeRecord['bounds'] => {
  const visible = getVisibleViewportBounds(viewport);
  const margin = Math.min(viewportPlacementMargin, visible.width * 0.12, visible.height * 0.12);
  const minX = visible.left + margin;
  const minY = visible.top + margin;
  const maxX = visible.left + visible.width - bounds.width - margin;
  const maxY = visible.top + visible.height - bounds.height - margin;

  return {
    ...bounds,
    x: maxX >= minX ? Math.min(Math.max(bounds.x, minX), maxX) : visible.centerX - bounds.width / 2,
    y: maxY >= minY ? Math.min(Math.max(bounds.y, minY), maxY) : visible.centerY - bounds.height / 2
  };
};

const getViewportStarterBounds = (
  existingNodes: GraphNodeRecord[],
  width: number,
  height: number,
  viewport: CanvasViewport
): GraphNodeRecord['bounds'] => {
  const visible = getVisibleViewportBounds(viewport);
  const slotGap = {
    x: Math.max(starterSlotGap.x, Math.round(48 / viewport.zoom)),
    y: Math.max(starterSlotGap.y, Math.round(48 / viewport.zoom))
  };
  const origin = {
    x: visible.centerX - width / 2,
    y: visible.centerY - height / 2
  };
  const offsets = [
    { x: 0, y: 0 },
    { x: width + slotGap.x, y: 0 },
    { x: -(width + slotGap.x), y: 0 },
    { x: 0, y: height + slotGap.y },
    { x: 0, y: -(height + slotGap.y) },
    { x: width + slotGap.x, y: height + slotGap.y },
    { x: -(width + slotGap.x), y: height + slotGap.y },
    { x: width + slotGap.x, y: -(height + slotGap.y) },
    { x: -(width + slotGap.x), y: -(height + slotGap.y) }
  ];

  for (const offset of offsets) {
    const bounds = clampToVisibleViewport(
      {
        x: origin.x + offset.x,
        y: origin.y + offset.y,
        width,
        height
      },
      viewport
    );
    const hasOverlap = existingNodes.some((node) => rectanglesOverlap(bounds, node.bounds));
    if (!hasOverlap) {
      return bounds;
    }
  }

  return clampToVisibleViewport({ x: origin.x, y: origin.y, width, height }, viewport);
};

const getStarterBounds = (
  existingNodes: GraphNodeRecord[],
  width: number,
  height: number
): GraphNodeRecord['bounds'] => {
  if (state.canvasViewport) {
    return getViewportStarterBounds(existingNodes, width, height, state.canvasViewport);
  }

  for (let row = 0; row < starterSlotRows; row += 1) {
    for (let column = 0; column < starterSlotColumns; column += 1) {
      const bounds = {
        x: starterSlotOrigin.x + column * (width + starterSlotGap.x),
        y: starterSlotOrigin.y + row * (height + starterSlotGap.y),
        width,
        height
      };
      const hasOverlap = existingNodes.some((node) => rectanglesOverlap(bounds, node.bounds));
      if (!hasOverlap) {
        return bounds;
      }
    }
  }

  const index = existingNodes.length;
  return {
    x: starterSlotOrigin.x + (index % starterSlotColumns) * (width + starterSlotGap.x),
    y:
      starterSlotOrigin.y +
      (Math.floor(index / starterSlotColumns) + 1) * (height + starterSlotGap.y),
    width,
    height
  };
};

const toLegacyCanvasNode = (node: GraphNodeRecord): CanvasNodeInput | null => {
  const config = getRecord(node.config);
  const graphState = getRecord(node.state);

  switch (node.componentType) {
    case 'builtin.note':
      return {
        id: node.id,
        type: 'note',
        x: node.bounds.x,
        y: node.bounds.y,
        contentMd: typeof graphState.content === 'string' ? graphState.content : ''
      };
    case 'builtin.terminal':
      return {
        id: node.id,
        type: 'terminal',
        x: node.bounds.x,
        y: node.bounds.y,
        command: typeof config.command === 'string' ? config.command : '',
        runtime: getRuntimeOrDefault(config.runtime)
      };
    case 'builtin.file-tree':
      return {
        id: node.id,
        type: 'file-tree',
        x: node.bounds.x,
        y: node.bounds.y,
        rootDir: typeof config.rootDir === 'string' ? config.rootDir : ''
      };
    case 'builtin.portal':
      return {
        id: node.id,
        type: 'portal',
        x: node.bounds.x,
        y: node.bounds.y,
        url: typeof config.url === 'string' ? config.url : ''
      };
    default:
      return null;
  }
};

const toLegacyCanvasNodes = (graphSnapshot: GraphSnapshotV2Input): CanvasNodeInput[] => {
  return graphSnapshot.nodes.flatMap((node) => {
    const legacyNode = toLegacyCanvasNode(node);
    return legacyNode ? [legacyNode] : [];
  });
};

const createNoteGraphNode = (existingNodes: GraphNodeRecord[]): GraphNodeRecord => {
  const manifest = getRequiredBuiltinManifest('builtin.note');
  const now = Date.now();
  const bounds = getStarterBounds(
    existingNodes,
    manifest.node.defaultSize.width,
    manifest.node.defaultSize.height
  );
  return {
    id: createNodeId('note'),
    componentType: 'builtin.note',
    componentVersion: manifest.version,
    title: manifest.node.defaultTitle,
    bounds,
    config: {
      ...(manifest.schema.config ?? {})
    },
    state: {
      ...(manifest.schema.state ?? {})
    },
    capabilities: [...manifest.capabilities],
    createdAtMs: now,
    updatedAtMs: now
  };
};

const createTerminalGraphNode = (
  existingNodes: GraphNodeRecord[],
  config?: Record<string, unknown>
): GraphNodeRecord => {
  const manifest = getRequiredBuiltinManifest('builtin.terminal');
  const now = Date.now();
  const bounds = getStarterBounds(
    existingNodes,
    manifest.node.defaultSize.width,
    manifest.node.defaultSize.height
  );
  return {
    id: createNodeId('terminal'),
    componentType: 'builtin.terminal',
    componentVersion: manifest.version,
    title: typeof config?.title === 'string' ? config.title : manifest.node.defaultTitle,
    bounds,
    config: {
      ...(manifest.schema.config ?? {}),
      ...(config ?? {})
    },
    state: {
      ...(manifest.schema.state ?? {})
    },
    capabilities: [...manifest.capabilities],
    createdAtMs: now,
    updatedAtMs: now
  };
};

const createFileTreeGraphNode = (existingNodes: GraphNodeRecord[], rootDir: string): GraphNodeRecord => {
  const manifest = getRequiredBuiltinManifest('builtin.file-tree');
  const now = Date.now();
  const bounds = getStarterBounds(
    existingNodes,
    manifest.node.defaultSize.width,
    manifest.node.defaultSize.height
  );
  return {
    id: createNodeId('file-tree'),
    componentType: 'builtin.file-tree',
    componentVersion: manifest.version,
    title: manifest.node.defaultTitle,
    bounds,
    config: {
      ...(manifest.schema.config ?? {}),
      rootDir
    },
    state: {
      ...(manifest.schema.state ?? {})
    },
    capabilities: [...manifest.capabilities],
    createdAtMs: now,
    updatedAtMs: now
  };
};

const createPortalGraphNode = (existingNodes: GraphNodeRecord[]): GraphNodeRecord => {
  const manifest = getRequiredBuiltinManifest('builtin.portal');
  const now = Date.now();
  const bounds = getStarterBounds(
    existingNodes,
    manifest.node.defaultSize.width,
    manifest.node.defaultSize.height
  );
  return {
    id: createNodeId('portal'),
    componentType: 'builtin.portal',
    componentVersion: manifest.version,
    title: manifest.node.defaultTitle,
    bounds,
    config: {
      ...(manifest.schema.config ?? {})
    },
    state: {
      ...(manifest.schema.state ?? {})
    },
    capabilities: [...manifest.capabilities],
    createdAtMs: now,
    updatedAtMs: now
  };
};

const createTextGraphNode = (existingNodes: GraphNodeRecord[]): GraphNodeRecord => {
  const manifest = getRequiredBuiltinManifest('builtin.text');
  const now = Date.now();
  const bounds = getStarterBounds(
    existingNodes,
    manifest.node.defaultSize.width,
    manifest.node.defaultSize.height
  );
  return {
    id: createNodeId('text'),
    componentType: 'builtin.text',
    componentVersion: manifest.version,
    title: manifest.node.defaultTitle,
    bounds,
    config: {
      ...(manifest.schema.config ?? {})
    },
    state: {
      ...(manifest.schema.state ?? {})
    },
    capabilities: [...manifest.capabilities],
    createdAtMs: now,
    updatedAtMs: now
  };
};

const applyGraphSnapshot = (
  graphSnapshot: GraphSnapshotV2Input,
  selectedNodeId: string | null = state.selectedNodeId
): void => {
  const selectedNodeStillExists = selectedNodeId
    ? graphSnapshot.nodes.some((node) => node.id === selectedNodeId)
    : false;

  setState({
    graphSnapshot,
    nodes: toLegacyCanvasNodes(graphSnapshot),
    selectedNodeId: selectedNodeStillExists ? selectedNodeId : null,
    selectedEdgeId:
      state.selectedEdgeId && graphSnapshot.edges.some((edge) => edge.id === state.selectedEdgeId)
        ? state.selectedEdgeId
        : null
  });
};

const persistGraphSnapshot = async (
  workspaceId: string,
  graphSnapshot: GraphSnapshotV2Input,
  selectedNodeId: string | null = state.selectedNodeId,
  deletedNodeIds?: string[]
): Promise<void> => {
  const requestId = ++latestSaveRequestId;
  const result = await getBridge().saveGraphSnapshot({
    workspaceId,
    graphSnapshot,
    ...(deletedNodeIds ? { deletedNodeIds } : {})
  });
  if (requestId !== latestSaveRequestId || state.workspaceId !== workspaceId) {
    return;
  }
  applyGraphSnapshot(result.graphSnapshot, selectedNodeId);
  setState({ errorMessage: null });
};

const updateGraphNode = (
  graphSnapshot: GraphSnapshotV2Input,
  nodeId: string,
  updater: (node: GraphNodeRecord) => GraphNodeRecord
): GraphSnapshotV2Input => {
  return {
    ...graphSnapshot,
    nodes: graphSnapshot.nodes.map((node) => (node.id === nodeId ? updater(node) : node))
  };
};

const isActiveRunStatus = (status: string): boolean => {
  return status !== 'completed' && status !== 'failed' && status !== 'stopped';
};

const stopActiveRunsForTerminalNodes = async (
  workspaceId: string,
  nodes: GraphNodeRecord[]
): Promise<void> => {
  const shell = getShellBridge();
  if (!shell?.runs) {
    return;
  }

  const terminalNodes = nodes.filter((node) => node.componentType === 'builtin.terminal');
  if (terminalNodes.length === 0) {
    return;
  }

  for (const node of terminalNodes) {
    const response = await shell.runs.listRuns({
      workspaceId,
      nodeId: node.id
    });
    const activeRuns = response.runs.filter((run) => isActiveRunStatus(run.status));
    for (const run of activeRuns) {
      await shell.runs.stopRun({
        workspaceId,
        runId: run.id
      });
    }
  }
};

export const canvasStore = {
  getState: (): CanvasState => state,
  subscribe: (listener: StateListener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  setCanvasViewport: (viewport: CanvasViewport): void => {
    if (
      Number.isFinite(viewport.x) &&
      Number.isFinite(viewport.y) &&
      Number.isFinite(viewport.zoom) &&
      viewport.zoom > 0 &&
      viewport.width > 0 &&
      viewport.height > 0
    ) {
      setState({ canvasViewport: viewport });
    }
  },
  toggleConnectMode: (): void => {
    setState({
      connectModeActive: !state.connectModeActive,
      connectSourceNodeId: null,
      selectedEdgeId: null,
      selectedNodeId: null
    });
  },
  exitConnectMode: (): void => {
    setState({
      connectModeActive: false,
      connectSourceNodeId: null
    });
  },
  setConnectSourceNode: (nodeId: string | null): void => {
    setState({ connectSourceNodeId: nodeId });
  },
  loadCanvasState: async (workspaceId: string): Promise<void> => {
    historyStore.clear();
    const requestId = ++latestLoadRequestId;
    setState({
      loading: true,
      workspaceId,
      graphSnapshot: emptyGraphSnapshot(),
      nodes: [],
      canvasViewport: null,
      selectedNodeId: null,
      recentAction: null,
      errorMessage: null
    });
    try {
      const result = await getBridge().loadGraphSnapshot({ workspaceId });
      if (requestId !== latestLoadRequestId || state.workspaceId !== workspaceId) {
        return;
      }
      setState({
        workspaceId,
        loading: false,
        errorMessage: null
      });
      applyGraphSnapshot(result.graphSnapshot);
    } catch (error) {
      if (requestId !== latestLoadRequestId || state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to load canvas';
      setState({
        loading: false,
        graphSnapshot: emptyGraphSnapshot(),
        nodes: [],
        selectedNodeId: null,
        errorMessage
      });
    }
  },
  refreshGraphSnapshot: async (workspaceId: string): Promise<void> => {
    if (state.workspaceId !== workspaceId) {
      return;
    }

    const requestId = ++latestRefreshRequestId;
    try {
      const result = await getBridge().loadGraphSnapshot({ workspaceId });
      if (requestId !== latestRefreshRequestId || state.workspaceId !== workspaceId) {
        return;
      }
      applyGraphSnapshot(result.graphSnapshot);
      setState({ errorMessage: null });
    } catch (error) {
      if (requestId !== latestRefreshRequestId || state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh canvas';
      setState({ errorMessage });
    }
  },
  selectNode: (nodeId: string | null): void => {
    setState({
      selectedNodeId: nodeId,
      recentAction: nodeId ? 'Focused node in inspector' : state.recentAction
    });
  },
  addNoteNode: async (): Promise<void> => {
    if (!state.workspaceId || state.loading) {
      return;
    }

    const workspaceId = state.workspaceId;
    const newNode = createNoteGraphNode(state.graphSnapshot.nodes);
    historyStore.push({ kind: 'addNode', node: newNode });
    const nextGraphSnapshot: GraphSnapshotV2Input = {
      ...state.graphSnapshot,
      nodes: [...state.graphSnapshot.nodes, newNode]
    };
    applyGraphSnapshot(nextGraphSnapshot, newNode.id);
    setState({ errorMessage: null, recentAction: 'Added note' });
    try {
      await persistGraphSnapshot(workspaceId, nextGraphSnapshot, newNode.id);
      const shell = getShellBridge();
      if (shell?.notes) {
        shell.notes.createFile({
          workspaceId,
          nodeId: newNode.id,
          title: newNode.title
        }).catch(() => { /* fire-and-forget */ });
      }
    } catch (error) {
      if (state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to save note node';
      setState({ errorMessage });
    }
  },
  addTerminalNode: async (config?: Record<string, unknown>): Promise<void> => {
    if (!state.workspaceId || state.loading) {
      return;
    }

    const workspaceId = state.workspaceId;
    const newNode = createTerminalGraphNode(state.graphSnapshot.nodes, config);
    historyStore.push({ kind: 'addNode', node: newNode });
    const nextGraphSnapshot: GraphSnapshotV2Input = {
      ...state.graphSnapshot,
      nodes: [...state.graphSnapshot.nodes, newNode]
    };
    applyGraphSnapshot(nextGraphSnapshot, newNode.id);
    setState({ errorMessage: null, recentAction: 'Added terminal' });
    try {
      await persistGraphSnapshot(workspaceId, nextGraphSnapshot, newNode.id);
    } catch (error) {
      if (state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to save terminal node';
      setState({ errorMessage });
    }
  },
  addFileTreeNode: async (rootDir: string): Promise<void> => {
    if (!state.workspaceId || state.loading) {
      return;
    }

    const workspaceId = state.workspaceId;
    const newNode = createFileTreeGraphNode(state.graphSnapshot.nodes, rootDir);
    historyStore.push({ kind: 'addNode', node: newNode });
    const nextGraphSnapshot: GraphSnapshotV2Input = {
      ...state.graphSnapshot,
      nodes: [...state.graphSnapshot.nodes, newNode]
    };
    applyGraphSnapshot(nextGraphSnapshot, newNode.id);
    setState({ errorMessage: null, recentAction: 'Added file tree' });
    try {
      await persistGraphSnapshot(workspaceId, nextGraphSnapshot, newNode.id);
    } catch (error) {
      if (state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to save file tree node';
      setState({ errorMessage });
    }
  },
  addPortalNode: async (): Promise<void> => {
    if (!state.workspaceId || state.loading) {
      return;
    }

    const workspaceId = state.workspaceId;
    const newNode = createPortalGraphNode(state.graphSnapshot.nodes);
    historyStore.push({ kind: 'addNode', node: newNode });
    const nextGraphSnapshot: GraphSnapshotV2Input = {
      ...state.graphSnapshot,
      nodes: [...state.graphSnapshot.nodes, newNode]
    };
    applyGraphSnapshot(nextGraphSnapshot, newNode.id);
    setState({ errorMessage: null, recentAction: 'Added portal' });
    try {
      await persistGraphSnapshot(workspaceId, nextGraphSnapshot, newNode.id);
    } catch (error) {
      if (state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to save portal node';
      setState({ errorMessage });
    }
  },
  addTextNode: async (): Promise<void> => {
    if (!state.workspaceId || state.loading) {
      return;
    }

    const workspaceId = state.workspaceId;
    const newNode = createTextGraphNode(state.graphSnapshot.nodes);
    historyStore.push({ kind: 'addNode', node: newNode });
    const nextGraphSnapshot: GraphSnapshotV2Input = {
      ...state.graphSnapshot,
      nodes: [...state.graphSnapshot.nodes, newNode]
    };
    applyGraphSnapshot(nextGraphSnapshot, newNode.id);
    setState({ errorMessage: null, recentAction: 'Added text' });
    try {
      await persistGraphSnapshot(workspaceId, nextGraphSnapshot, newNode.id);
    } catch (error) {
      if (state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to save text node';
      setState({ errorMessage });
    }
  },
  addNodeAtBounds: async (
    componentType: string,
    bounds: {
      x: number;
      y: number;
      width: number;
      height: number;
    },
    rootDir?: string,
    config?: Record<string, unknown>
  ): Promise<void> => {
    if (!state.workspaceId || state.loading) {
      return;
    }

    const workspaceId = state.workspaceId;
    const existingNodes = state.graphSnapshot.nodes;
    let newNode: GraphNodeRecord;

    switch (componentType) {
      case 'builtin.note':
        newNode = createNoteGraphNode(existingNodes);
        break;
      case 'builtin.terminal':
        newNode = createTerminalGraphNode(existingNodes, config);
        break;
      case 'builtin.file-tree':
        newNode = createFileTreeGraphNode(existingNodes, rootDir ?? '');
        break;
      case 'builtin.portal':
        newNode = createPortalGraphNode(existingNodes);
        break;
      case 'builtin.text':
        newNode = createTextGraphNode(existingNodes);
        break;
      default:
        return;
    }

    newNode = { ...newNode, bounds };
    historyStore.push({ kind: 'addNode', node: newNode });

    const nextGraphSnapshot: GraphSnapshotV2Input = {
      ...state.graphSnapshot,
      nodes: [...state.graphSnapshot.nodes, newNode]
    };
    applyGraphSnapshot(nextGraphSnapshot, newNode.id);
    setState({ errorMessage: null, recentAction: `Added ${componentType.replace('builtin.', '')}` });
    try {
      await persistGraphSnapshot(workspaceId, nextGraphSnapshot, newNode.id);
    } catch (error) {
      if (state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to add node';
      setState({ errorMessage });
    }
  },
  updateNoteNode: async (
    nodeId: string,
    patch: Partial<Pick<NoteNodeInput, 'x' | 'y' | 'contentMd'> & { viewMode?: string; title?: string; backgroundColor?: string; opacity?: number; fontSize?: number }>
  ): Promise<void> => {
    if (!state.workspaceId) {
      return;
    }

    const workspaceId = state.workspaceId;
    const nextGraphSnapshot = updateGraphNode(state.graphSnapshot, nodeId, (node) => {
      if (node.componentType !== 'builtin.note') {
        return node;
      }

      return {
        ...node,
        bounds: {
          ...node.bounds,
          x: patch.x ?? node.bounds.x,
          y: patch.y ?? node.bounds.y
        },
        title: patch.title !== undefined ? patch.title : node.title,
        state: {
          ...node.state,
          ...(patch.contentMd !== undefined ? { content: patch.contentMd } : {}),
          ...(patch.viewMode !== undefined ? { viewMode: patch.viewMode } : {}),
          ...(patch.backgroundColor !== undefined ? { backgroundColor: patch.backgroundColor } : {}),
          ...(patch.opacity !== undefined ? { opacity: patch.opacity } : {}),
          ...(patch.fontSize !== undefined ? { fontSize: patch.fontSize } : {})
        },
        updatedAtMs: Date.now()
      };
    });

    applyGraphSnapshot(nextGraphSnapshot);
    setState({ errorMessage: null, recentAction: 'Updated note' });
    try {
      await persistGraphSnapshot(workspaceId, nextGraphSnapshot);
    } catch (error) {
      if (state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to update note node';
      setState({ errorMessage });
    }
  },
  renameNoteNode: async (nodeId: string, newTitle: string): Promise<void> => {
    if (!state.workspaceId) {
      return;
    }

    const workspaceId = state.workspaceId;
    const node = state.graphSnapshot.nodes.find((n) => n.id === nodeId);
    if (!node || node.componentType !== 'builtin.note') {
      return;
    }

    const oldTitle = node.title;
    if (oldTitle === newTitle) {
      return;
    }

    // Validate uniqueness via IPC
    const shell = getShellBridge();
    if (shell?.notes) {
      try {
        await shell.notes.renameFile({
          workspaceId,
          nodeId,
          oldTitle,
          newTitle
        });
      } catch (error) {
        throw error;
      }
    }

    const nextGraphSnapshot = updateGraphNode(state.graphSnapshot, nodeId, (n) => ({
      ...n,
      title: newTitle,
      updatedAtMs: Date.now()
    }));

    historyStore.push({ kind: 'renameNode', nodeId, oldTitle, newTitle });
    applyGraphSnapshot(nextGraphSnapshot);
    setState({ errorMessage: null, recentAction: `Renamed note to "${newTitle}"` });
    try {
      await persistGraphSnapshot(workspaceId, nextGraphSnapshot);
    } catch (error) {
      if (state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to rename note node';
      setState({ errorMessage });
    }
  },
  updateTerminalNode: async (
    nodeId: string,
    patch: Partial<Pick<TerminalNodeInput, 'x' | 'y' | 'command' | 'runtime'>> & Record<string, unknown>
  ): Promise<void> => {
    if (!state.workspaceId) {
      return;
    }

    const workspaceId = state.workspaceId;
    const configPatch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (!['x', 'y', 'command', 'runtime'].includes(key) && value !== undefined) {
        configPatch[key] = value;
      }
    }

    const nextGraphSnapshot = updateGraphNode(state.graphSnapshot, nodeId, (node) => {
      if (node.componentType !== 'builtin.terminal') {
        return node;
      }

      return {
        ...node,
        bounds: {
          ...node.bounds,
          x: patch.x ?? node.bounds.x,
          y: patch.y ?? node.bounds.y
        },
        title: configPatch.title !== undefined ? String(configPatch.title) : node.title,
        config: {
          ...node.config,
          ...(patch.command !== undefined ? { command: patch.command } : {}),
          ...(patch.runtime !== undefined ? { runtime: patch.runtime } : {}),
          ...configPatch
        },
        updatedAtMs: Date.now()
      };
    });

    applyGraphSnapshot(nextGraphSnapshot);
    setState({ errorMessage: null, recentAction: 'Updated terminal' });
    try {
      await persistGraphSnapshot(workspaceId, nextGraphSnapshot);
    } catch (error) {
      if (state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to update terminal node';
      setState({ errorMessage });
    }
  },
  updateFileTreeNode: async (
    nodeId: string,
    patch: Partial<Pick<FileTreeNodeInput, 'x' | 'y'>>
  ): Promise<void> => {
    if (!state.workspaceId) {
      return;
    }

    const workspaceId = state.workspaceId;
    const nextGraphSnapshot = updateGraphNode(state.graphSnapshot, nodeId, (node) => {
      if (node.componentType !== 'builtin.file-tree') {
        return node;
      }

      return {
        ...node,
        bounds: {
          ...node.bounds,
          x: patch.x ?? node.bounds.x,
          y: patch.y ?? node.bounds.y
        },
        updatedAtMs: Date.now()
      };
    });

    applyGraphSnapshot(nextGraphSnapshot);
    setState({ errorMessage: null, recentAction: 'Updated file tree' });
    try {
      await persistGraphSnapshot(workspaceId, nextGraphSnapshot);
    } catch (error) {
      if (state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to update file tree node';
      setState({ errorMessage });
    }
  },
  updatePortalNode: async (
    nodeId: string,
    patch: Partial<Pick<PortalNodeInput, 'x' | 'y' | 'url'>>
  ): Promise<void> => {
    if (!state.workspaceId) {
      return;
    }

    const workspaceId = state.workspaceId;
    const nextGraphSnapshot = updateGraphNode(state.graphSnapshot, nodeId, (node) => {
      if (node.componentType !== 'builtin.portal') {
        return node;
      }

      return {
        ...node,
        bounds: {
          ...node.bounds,
          x: patch.x ?? node.bounds.x,
          y: patch.y ?? node.bounds.y
        },
        config: {
          ...node.config,
          ...(patch.url !== undefined ? { url: patch.url } : {})
        },
        updatedAtMs: Date.now()
      };
    });

    applyGraphSnapshot(nextGraphSnapshot);
    setState({ errorMessage: null, recentAction: 'Updated portal' });
    try {
      await persistGraphSnapshot(workspaceId, nextGraphSnapshot);
    } catch (error) {
      if (state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to update portal node';
      setState({ errorMessage });
    }
  },
  updateNodePosition: async (
    nodeId: string,
    position: {
      x: number;
      y: number;
    }
  ): Promise<void> => {
    if (!state.workspaceId) {
      return;
    }

    const workspaceId = state.workspaceId;
    const oldNode = state.graphSnapshot.nodes.find((n) => n.id === nodeId);
    const oldPosition = oldNode ? { x: oldNode.bounds.x, y: oldNode.bounds.y } : { x: position.x, y: position.y };
    const nextGraphSnapshot = updateGraphNode(state.graphSnapshot, nodeId, (node) => ({
      ...node,
      bounds: {
        ...node.bounds,
        x: position.x,
        y: position.y
      },
      updatedAtMs: Date.now()
    }));
    historyStore.push({
      kind: 'moveNode',
      nodeId,
      from: oldPosition,
      to: { x: position.x, y: position.y }
    });

    applyGraphSnapshot(nextGraphSnapshot);
    setState({ errorMessage: null, recentAction: 'Moved node on canvas' });
    try {
      await persistGraphSnapshot(workspaceId, nextGraphSnapshot);
    } catch (error) {
      if (state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to move graph node';
      setState({ errorMessage });
    }
  },
  updateNodeBounds: async (
    nodeId: string,
    bounds: {
      x: number;
      y: number;
      width: number;
      height: number;
    }
  ): Promise<void> => {
    if (!state.workspaceId) {
      return;
    }

    const workspaceId = state.workspaceId;
    const oldNode = state.graphSnapshot.nodes.find((n) => n.id === nodeId);
    const oldBounds = oldNode
      ? { x: oldNode.bounds.x, y: oldNode.bounds.y, width: oldNode.bounds.width, height: oldNode.bounds.height }
      : { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    const nextGraphSnapshot = updateGraphNode(state.graphSnapshot, nodeId, (node) => ({
      ...node,
      bounds: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      },
      updatedAtMs: Date.now()
    }));
    historyStore.push({
      kind: 'resizeNode',
      nodeId,
      from: oldBounds,
      to: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
    });

    applyGraphSnapshot(nextGraphSnapshot);
    setState({ errorMessage: null, recentAction: 'Resized node on canvas' });
    try {
      await persistGraphSnapshot(workspaceId, nextGraphSnapshot);
    } catch (error) {
      if (state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to resize graph node';
      setState({ errorMessage });
    }
  },
  deleteNodes: async (nodeIds: string[]): Promise<void> => {
    if (!state.workspaceId || state.loading || nodeIds.length === 0) {
      return;
    }

    const workspaceId = state.workspaceId;
    const nodesToDelete = state.graphSnapshot.nodes.filter((node) => nodeIds.includes(node.id));
    if (nodesToDelete.length === 0) {
      return;
    }

    try {
      await stopActiveRunsForTerminalNodes(workspaceId, nodesToDelete);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to stop terminal run(s)';
      setState({ errorMessage });
      return;
    }

    const deletedNodeIds = new Set(nodeIds);
    const nextGraphSnapshot: GraphSnapshotV2Input = {
      ...state.graphSnapshot,
      nodes: state.graphSnapshot.nodes.filter((node) => !deletedNodeIds.has(node.id)),
      edges: state.graphSnapshot.edges.filter(
        (edge) => !deletedNodeIds.has(edge.source) && !deletedNodeIds.has(edge.target)
      )
    };

    // Collect and push edge removals for edges connected to deleted nodes
    const connectedEdges = state.graphSnapshot.edges.filter(
      (edge) => deletedNodeIds.has(edge.source) || deletedNodeIds.has(edge.target)
    );
    for (const edge of connectedEdges) {
      historyStore.push({ kind: 'removeEdge', edge });
    }

    // Push history entries for each deleted node (in reverse order so undo restores them in correct order)
    for (let i = nodesToDelete.length - 1; i >= 0; i -= 1) {
      historyStore.push({ kind: 'removeNode', node: nodesToDelete[i] });
    }

    applyGraphSnapshot(nextGraphSnapshot);
    setState({ errorMessage: null, recentAction: `Deleted ${nodesToDelete.length} node(s)` });
    try {
      await persistGraphSnapshot(workspaceId, nextGraphSnapshot, null, nodeIds);
      // Clean up note files for deleted note nodes
      const shell = getShellBridge();
      if (shell?.notes) {
        for (const noteNode of nodesToDelete) {
          if (noteNode.componentType === 'builtin.note') {
            shell.notes.deleteFile({
              workspaceId,
              nodeId: noteNode.id,
              title: noteNode.title
            }).catch(() => { /* fire-and-forget */ });
          }
        }
      }
    } catch (error) {
      if (state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete node(s)';
      setState({ errorMessage });
    }
  },
  deleteSelectedNode: async (): Promise<void> => {
    if (state.selectedEdgeId) {
      await canvasStore.deleteSelectedEdge();
      return;
    }
    if (!state.selectedNodeId) {
      return;
    }
    await canvasStore.deleteNodes([state.selectedNodeId]);
  },
  addEdge: async (source: string, target: string): Promise<void> => {
    if (!state.workspaceId || state.loading) return;
    if (source === target) {
      setState({ connectModeActive: false, connectSourceNodeId: null });
      return;
    }

    const workspaceId = state.workspaceId;
    // Check for duplicate (bidirectional: source->target or target->source)
    const alreadyExists = state.graphSnapshot.edges.some(
      (e) => (e.source === source && e.target === target) || (e.source === target && e.target === source)
    );
    if (alreadyExists) {
      setState({ recentAction: 'Connection already exists', connectModeActive: false, connectSourceNodeId: null });
      return;
    }

    const now = Date.now();
    const edgeId = `edge-${crypto.randomUUID()}`;
    const newEdge: GraphEdgeRecord = {
      id: edgeId,
      source,
      target,
      sourceHandle: null,
      targetHandle: null,
      label: null,
      meta: {},
      createdAtMs: now,
      updatedAtMs: now
    };

    const nextGraphSnapshot = {
      ...state.graphSnapshot,
      edges: [...state.graphSnapshot.edges, newEdge]
    };

    historyStore.push({ kind: 'addEdge', edge: newEdge });
    applyGraphSnapshot(nextGraphSnapshot);
    setState({ recentAction: 'Connected components', connectModeActive: false, connectSourceNodeId: null });
    try {
      await persistGraphSnapshot(workspaceId, nextGraphSnapshot);
    } catch (error) {
      if (state.workspaceId !== workspaceId) return;
      const errorMessage = error instanceof Error ? error.message : 'Failed to save edge';
      setState({ errorMessage });
    }
  },
  deleteSelectedEdge: async (): Promise<void> => {
    if (!state.workspaceId || !state.selectedEdgeId) return;
    const workspaceId = state.workspaceId;
    const edgeId = state.selectedEdgeId;

    const nextGraphSnapshot = {
      ...state.graphSnapshot,
      edges: state.graphSnapshot.edges.filter((e) => e.id !== edgeId)
    };

    const deletedEdge = state.graphSnapshot.edges.find((e) => e.id === edgeId);
    if (deletedEdge) {
      historyStore.push({ kind: 'removeEdge', edge: deletedEdge });
    }

    applyGraphSnapshot(nextGraphSnapshot, null);
    setState({ selectedEdgeId: null, recentAction: 'Deleted connection' });
    try {
      await persistGraphSnapshot(workspaceId, nextGraphSnapshot);
    } catch (error) {
      if (state.workspaceId !== workspaceId) return;
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete edge';
      setState({ errorMessage });
    }
  },
  selectEdge: (edgeId: string | null): void => {
    setState({
      selectedEdgeId: edgeId,
      selectedNodeId: edgeId ? null : state.selectedNodeId
    });
  },
  setActiveEdgeIds: (edgeIds: string[]): void => {
    const activeEdgeIds = new Set(edgeIds);
    setState({
      activeEdgeIds: edgeIds,
      selectedEdgeId:
        state.selectedEdgeId && activeEdgeIds.has(state.selectedEdgeId)
          ? null
          : state.selectedEdgeId
    });
  },
  undo: async (): Promise<void> => {
    if (!state.workspaceId || state.loading) {
      return;
    }
    const entry = historyStore.undo();
    if (!entry) {
      return;
    }

    const workspaceId = state.workspaceId;
    let nextGraphSnapshot = state.graphSnapshot;

    switch (entry.kind) {
      case 'addNode': {
        const nodeId = entry.node.id;
        nextGraphSnapshot = {
          ...nextGraphSnapshot,
          nodes: nextGraphSnapshot.nodes.filter((n) => n.id !== nodeId),
          edges: nextGraphSnapshot.edges.filter(
            (e) => e.source !== nodeId && e.target !== nodeId
          )
        };
        break;
      }
      case 'removeNode': {
        nextGraphSnapshot = {
          ...nextGraphSnapshot,
          nodes: [...nextGraphSnapshot.nodes, entry.node]
        };
        break;
      }
      case 'moveNode': {
        nextGraphSnapshot = updateGraphNode(nextGraphSnapshot, entry.nodeId, (node) => ({
          ...node,
          bounds: { ...node.bounds, x: entry.from.x, y: entry.from.y },
          updatedAtMs: Date.now()
        }));
        break;
      }
      case 'resizeNode': {
        nextGraphSnapshot = updateGraphNode(nextGraphSnapshot, entry.nodeId, (node) => ({
          ...node,
          bounds: { ...entry.from },
          updatedAtMs: Date.now()
        }));
        break;
      }
      case 'renameNode': {
        nextGraphSnapshot = updateGraphNode(nextGraphSnapshot, entry.nodeId, (node) => ({
          ...node,
          title: entry.oldTitle,
          updatedAtMs: Date.now()
        }));
        break;
      }
      case 'addEdge': {
        nextGraphSnapshot = {
          ...nextGraphSnapshot,
          edges: nextGraphSnapshot.edges.filter((e) => e.id !== entry.edge.id)
        };
        break;
      }
      case 'removeEdge': {
        nextGraphSnapshot = {
          ...nextGraphSnapshot,
          edges: [...nextGraphSnapshot.edges, entry.edge]
        };
        break;
      }
    }

    applyGraphSnapshot(nextGraphSnapshot);
    setState({ errorMessage: null, recentAction: 'Undo' });
    try {
      await persistGraphSnapshot(workspaceId, nextGraphSnapshot);
    } catch (error) {
      if (state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to undo';
      setState({ errorMessage });
    }
  },
  redo: async (): Promise<void> => {
    if (!state.workspaceId || state.loading) {
      return;
    }
    const entry = historyStore.redo();
    if (!entry) {
      return;
    }

    const workspaceId = state.workspaceId;
    let nextGraphSnapshot = state.graphSnapshot;

    switch (entry.kind) {
      case 'addNode': {
        nextGraphSnapshot = {
          ...nextGraphSnapshot,
          nodes: [...nextGraphSnapshot.nodes, entry.node]
        };
        break;
      }
      case 'removeNode': {
        const nodeId = entry.node.id;
        nextGraphSnapshot = {
          ...nextGraphSnapshot,
          nodes: nextGraphSnapshot.nodes.filter((n) => n.id !== nodeId),
          edges: nextGraphSnapshot.edges.filter(
            (e) => e.source !== nodeId && e.target !== nodeId
          )
        };
        break;
      }
      case 'moveNode': {
        nextGraphSnapshot = updateGraphNode(nextGraphSnapshot, entry.nodeId, (node) => ({
          ...node,
          bounds: { ...node.bounds, x: entry.to.x, y: entry.to.y },
          updatedAtMs: Date.now()
        }));
        break;
      }
      case 'resizeNode': {
        nextGraphSnapshot = updateGraphNode(nextGraphSnapshot, entry.nodeId, (node) => ({
          ...node,
          bounds: { ...entry.to },
          updatedAtMs: Date.now()
        }));
        break;
      }
      case 'renameNode': {
        nextGraphSnapshot = updateGraphNode(nextGraphSnapshot, entry.nodeId, (node) => ({
          ...node,
          title: entry.newTitle,
          updatedAtMs: Date.now()
        }));
        break;
      }
      case 'addEdge': {
        nextGraphSnapshot = {
          ...nextGraphSnapshot,
          edges: [...nextGraphSnapshot.edges, entry.edge]
        };
        break;
      }
      case 'removeEdge': {
        nextGraphSnapshot = {
          ...nextGraphSnapshot,
          edges: nextGraphSnapshot.edges.filter((e) => e.id !== entry.edge.id)
        };
        break;
      }
    }

    applyGraphSnapshot(nextGraphSnapshot);
    setState({ errorMessage: null, recentAction: 'Redo' });
    try {
      await persistGraphSnapshot(workspaceId, nextGraphSnapshot);
    } catch (error) {
      if (state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to redo';
      setState({ errorMessage });
    }
  }
};

export const useCanvasStore = <T,>(selector: (storeState: CanvasState) => T): T => {
  return useSyncExternalStore(
    canvasStore.subscribe,
    () => selector(canvasStore.getState()),
    () => selector(initialState)
  );
};
