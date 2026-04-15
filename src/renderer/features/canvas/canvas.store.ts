import { useSyncExternalStore } from 'react';
import type { OpenWeaveShellBridge } from '../../../shared/ipc/contracts';
import type {
  CanvasNodeInput,
  CanvasStateInput,
  NoteNodeInput,
  TerminalNodeInput
} from '../../../shared/ipc/schemas';

interface CanvasState {
  workspaceId: string | null;
  nodes: CanvasNodeInput[];
  edges: CanvasStateInput['edges'];
  loading: boolean;
  errorMessage: string | null;
}

const initialState: CanvasState = {
  workspaceId: null,
  nodes: [],
  edges: [],
  loading: false,
  errorMessage: null
};

type StateListener = () => void;

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

const getBridge = (): OpenWeaveShellBridge['canvas'] => {
  const shell = (window as Window & { openweaveShell?: OpenWeaveShellBridge }).openweaveShell;
  if (!shell) {
    throw new Error('openweaveShell bridge is unavailable');
  }
  return shell.canvas;
};

const createNoteNode = (): NoteNodeInput => {
  const fallbackId = `note-${Date.now()}`;
  const generatedId =
    typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : fallbackId;
  return {
    id: `note-${generatedId}`,
    type: 'note',
    x: 80,
    y: 80,
    contentMd: ''
  };
};

const createTerminalNode = (): TerminalNodeInput => {
  const fallbackId = `terminal-${Date.now()}`;
  const generatedId =
    typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : fallbackId;
  return {
    id: `terminal-${generatedId}`,
    type: 'terminal',
    x: 160,
    y: 120,
    command: 'echo hello'
  };
};

const persistCanvasState = async (
  workspaceId: string,
  nodes: CanvasNodeInput[],
  edges: CanvasStateInput['edges']
): Promise<void> => {
  const requestId = ++latestSaveRequestId;
  const result = await getBridge().saveCanvasState({
    workspaceId,
    state: { nodes, edges }
  });
  if (requestId !== latestSaveRequestId || state.workspaceId !== workspaceId) {
    return;
  }
  setState({
    nodes: result.state.nodes,
    edges: result.state.edges,
    errorMessage: null
  });
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
      nodes: [],
      edges: [],
      errorMessage: null
    });
    try {
      const result = await getBridge().loadCanvasState({ workspaceId });
      if (requestId !== latestLoadRequestId || state.workspaceId !== workspaceId) {
        return;
      }
      setState({
        workspaceId,
        nodes: result.state.nodes,
        edges: result.state.edges,
        loading: false,
        errorMessage: null
      });
    } catch (error) {
      if (requestId !== latestLoadRequestId || state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to load canvas';
      setState({ loading: false, nodes: [], edges: [], errorMessage });
    }
  },
  addNoteNode: async (): Promise<void> => {
    if (!state.workspaceId) {
      return;
    }

    const workspaceId = state.workspaceId;
    const nextNodes = [...state.nodes, createNoteNode()];
    setState({ nodes: nextNodes, errorMessage: null });
    try {
      await persistCanvasState(workspaceId, nextNodes, state.edges);
    } catch (error) {
      if (state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to save note node';
      setState({ errorMessage });
    }
  },
  addTerminalNode: async (): Promise<void> => {
    if (!state.workspaceId) {
      return;
    }

    const workspaceId = state.workspaceId;
    const nextNodes = [...state.nodes, createTerminalNode()];
    setState({ nodes: nextNodes, errorMessage: null });
    try {
      await persistCanvasState(workspaceId, nextNodes, state.edges);
    } catch (error) {
      if (state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to save terminal node';
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
    const nextNodes = state.nodes.map((node) => {
      if (node.id !== nodeId || node.type !== 'note') {
        return node;
      }

      return {
        ...node,
        ...patch
      };
    });

    setState({ nodes: nextNodes, errorMessage: null });
    try {
      await persistCanvasState(workspaceId, nextNodes, state.edges);
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
    patch: Partial<Pick<TerminalNodeInput, 'x' | 'y' | 'command'>>
  ): Promise<void> => {
    if (!state.workspaceId) {
      return;
    }

    const workspaceId = state.workspaceId;
    const nextNodes = state.nodes.map((node) => {
      if (node.id !== nodeId || node.type !== 'terminal') {
        return node;
      }

      return {
        ...node,
        ...patch
      };
    });

    setState({ nodes: nextNodes, errorMessage: null });
    try {
      await persistCanvasState(workspaceId, nextNodes, state.edges);
    } catch (error) {
      if (state.workspaceId !== workspaceId) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to update terminal node';
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
