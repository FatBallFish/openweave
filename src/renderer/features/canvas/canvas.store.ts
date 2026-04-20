import { useSyncExternalStore } from 'react';
import type { OpenWeaveShellBridge } from '../../../shared/ipc/contracts';
import { getBuiltinComponentManifest } from '../../../shared/components/builtin-manifests';
import type {
  CanvasNodeInput,
  FileTreeNodeInput,
  GraphSnapshotV2Input,
  NoteNodeInput,
  PortalNodeInput,
  RunRuntimeInput,
  TerminalNodeInput
} from '../../../shared/ipc/schemas';

interface CanvasState {
  workspaceId: string | null;
  graphSnapshot: GraphSnapshotV2Input;
  nodes: CanvasNodeInput[];
  selectedNodeId: string | null;
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
  selectedNodeId: null,
  recentAction: null,
  loading: false,
  errorMessage: null
};

type StateListener = () => void;
type GraphNodeRecord = GraphSnapshotV2Input['nodes'][number];
const supportedRuntimes: RunRuntimeInput[] = ['shell', 'codex', 'claude', 'opencode'];

let state: CanvasState = initialState;
const listeners = new Set<StateListener>();
let latestLoadRequestId = 0;
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

const createNoteGraphNode = (): GraphNodeRecord => {
  const manifest = getRequiredBuiltinManifest('builtin.note');
  const now = Date.now();
  return {
    id: createNodeId('note'),
    componentType: 'builtin.note',
    componentVersion: manifest.version,
    title: manifest.node.defaultTitle,
    bounds: {
      x: 80,
      y: 80,
      width: manifest.node.defaultSize.width,
      height: manifest.node.defaultSize.height
    },
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

const createTerminalGraphNode = (): GraphNodeRecord => {
  const manifest = getRequiredBuiltinManifest('builtin.terminal');
  const now = Date.now();
  return {
    id: createNodeId('terminal'),
    componentType: 'builtin.terminal',
    componentVersion: manifest.version,
    title: manifest.node.defaultTitle,
    bounds: {
      x: 520,
      y: 80,
      width: manifest.node.defaultSize.width,
      height: manifest.node.defaultSize.height
    },
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

const createFileTreeGraphNode = (rootDir: string): GraphNodeRecord => {
  const manifest = getRequiredBuiltinManifest('builtin.file-tree');
  const now = Date.now();
  return {
    id: createNodeId('file-tree'),
    componentType: 'builtin.file-tree',
    componentVersion: manifest.version,
    title: manifest.node.defaultTitle,
    bounds: {
      x: 80,
      y: 360,
      width: manifest.node.defaultSize.width,
      height: manifest.node.defaultSize.height
    },
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

const createPortalGraphNode = (): GraphNodeRecord => {
  const manifest = getRequiredBuiltinManifest('builtin.portal');
  const now = Date.now();
  return {
    id: createNodeId('portal'),
    componentType: 'builtin.portal',
    componentVersion: manifest.version,
    title: manifest.node.defaultTitle,
    bounds: {
      x: 520,
      y: 360,
      width: manifest.node.defaultSize.width,
      height: manifest.node.defaultSize.height
    },
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

const createTextGraphNode = (): GraphNodeRecord => {
  const manifest = getRequiredBuiltinManifest('builtin.text');
  const now = Date.now();
  return {
    id: createNodeId('text'),
    componentType: 'builtin.text',
    componentVersion: manifest.version,
    title: manifest.node.defaultTitle,
    bounds: {
      x: 940,
      y: 160,
      width: manifest.node.defaultSize.width,
      height: manifest.node.defaultSize.height
    },
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

const applyGraphSnapshot = (graphSnapshot: GraphSnapshotV2Input): void => {
  const selectedNodeStillExists = state.selectedNodeId
    ? graphSnapshot.nodes.some((node) => node.id === state.selectedNodeId)
    : false;

  setState({
    graphSnapshot,
    nodes: toLegacyCanvasNodes(graphSnapshot),
    selectedNodeId: selectedNodeStillExists ? state.selectedNodeId : null
  });
};

const persistGraphSnapshot = async (
  workspaceId: string,
  graphSnapshot: GraphSnapshotV2Input
): Promise<void> => {
  const requestId = ++latestSaveRequestId;
  const result = await getBridge().saveGraphSnapshot({
    workspaceId,
    graphSnapshot
  });
  if (requestId !== latestSaveRequestId || state.workspaceId !== workspaceId) {
    return;
  }
  applyGraphSnapshot(result.graphSnapshot);
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

export const canvasStore = {
  getState: (): CanvasState => state,
  subscribe: (listener: StateListener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  loadCanvasState: async (workspaceId: string): Promise<void> => {
    const requestId = ++latestLoadRequestId;
    setState({
      loading: true,
      workspaceId,
      graphSnapshot: emptyGraphSnapshot(),
      nodes: [],
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
    const nextGraphSnapshot: GraphSnapshotV2Input = {
      ...state.graphSnapshot,
      nodes: [...state.graphSnapshot.nodes, createNoteGraphNode()]
    };
    applyGraphSnapshot(nextGraphSnapshot);
    setState({ errorMessage: null, recentAction: 'Added note' });
    try {
      await persistGraphSnapshot(workspaceId, nextGraphSnapshot);
    } catch (error) {
      if (state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to save note node';
      setState({ errorMessage });
    }
  },
  addTerminalNode: async (): Promise<void> => {
    if (!state.workspaceId || state.loading) {
      return;
    }

    const workspaceId = state.workspaceId;
    const nextGraphSnapshot: GraphSnapshotV2Input = {
      ...state.graphSnapshot,
      nodes: [...state.graphSnapshot.nodes, createTerminalGraphNode()]
    };
    applyGraphSnapshot(nextGraphSnapshot);
    setState({ errorMessage: null, recentAction: 'Added terminal' });
    try {
      await persistGraphSnapshot(workspaceId, nextGraphSnapshot);
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
    const nextGraphSnapshot: GraphSnapshotV2Input = {
      ...state.graphSnapshot,
      nodes: [...state.graphSnapshot.nodes, createFileTreeGraphNode(rootDir)]
    };
    applyGraphSnapshot(nextGraphSnapshot);
    setState({ errorMessage: null, recentAction: 'Added file tree' });
    try {
      await persistGraphSnapshot(workspaceId, nextGraphSnapshot);
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
    const nextGraphSnapshot: GraphSnapshotV2Input = {
      ...state.graphSnapshot,
      nodes: [...state.graphSnapshot.nodes, createPortalGraphNode()]
    };
    applyGraphSnapshot(nextGraphSnapshot);
    setState({ errorMessage: null, recentAction: 'Added portal' });
    try {
      await persistGraphSnapshot(workspaceId, nextGraphSnapshot);
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
    const nextGraphSnapshot: GraphSnapshotV2Input = {
      ...state.graphSnapshot,
      nodes: [...state.graphSnapshot.nodes, createTextGraphNode()]
    };
    applyGraphSnapshot(nextGraphSnapshot);
    setState({ errorMessage: null, recentAction: 'Added text' });
    try {
      await persistGraphSnapshot(workspaceId, nextGraphSnapshot);
    } catch (error) {
      if (state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to save text node';
      setState({ errorMessage });
    }
  },
  updateNoteNode: async (
    nodeId: string,
    patch: Partial<Pick<NoteNodeInput, 'x' | 'y' | 'contentMd'>>
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
        state: {
          ...node.state,
          ...(patch.contentMd !== undefined ? { content: patch.contentMd } : {})
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
  updateTerminalNode: async (
    nodeId: string,
    patch: Partial<Pick<TerminalNodeInput, 'x' | 'y' | 'command' | 'runtime'>>
  ): Promise<void> => {
    if (!state.workspaceId) {
      return;
    }

    const workspaceId = state.workspaceId;
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
        config: {
          ...node.config,
          ...(patch.command !== undefined ? { command: patch.command } : {}),
          ...(patch.runtime !== undefined ? { runtime: patch.runtime } : {})
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
    const nextGraphSnapshot = updateGraphNode(state.graphSnapshot, nodeId, (node) => ({
      ...node,
      bounds: {
        ...node.bounds,
        x: position.x,
        y: position.y
      },
      updatedAtMs: Date.now()
    }));

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
  }
};

export const useCanvasStore = <T,>(selector: (storeState: CanvasState) => T): T => {
  return useSyncExternalStore(
    canvasStore.subscribe,
    () => selector(canvasStore.getState()),
    () => selector(initialState)
  );
};
