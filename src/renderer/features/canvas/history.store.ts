import { useSyncExternalStore } from 'react';
import type { GraphNodeRecord } from '../../../shared/ipc/contracts';
import { settingsStore } from '../workbench/settings.store';

type HistoryEntry =
  | { kind: 'addNode'; node: GraphNodeRecord }
  | { kind: 'removeNode'; node: GraphNodeRecord }
  | { kind: 'moveNode'; nodeId: string; from: { x: number; y: number }; to: { x: number; y: number } }
  | { kind: 'resizeNode'; nodeId: string; from: GraphNodeRecord['bounds']; to: GraphNodeRecord['bounds'] };

interface HistoryState {
  stack: HistoryEntry[];
  index: number;
}

type HistoryListener = () => void;

const initialState: HistoryState = {
  stack: [],
  index: -1
};

let state: HistoryState = initialState;
const listeners = new Set<HistoryListener>();

const setState = (nextState: Partial<HistoryState>): void => {
  state = { ...state, ...nextState };
  for (const listener of listeners) {
    listener();
  }
};

const getMaxSize = (): number => settingsStore.getState().maxUndoSteps;

const trimStack = (stack: HistoryEntry[], index: number): { stack: HistoryEntry[]; index: number } => {
  const maxSize = getMaxSize();
  if (stack.length <= maxSize) {
    return { stack, index };
  }
  const overflow = stack.length - maxSize;
  return {
    stack: stack.slice(overflow),
    index: index - overflow
  };
};

export const historyStore = {
  getState: (): HistoryState & { canUndo: boolean; canRedo: boolean } => ({
    ...state,
    canUndo: state.index >= 0,
    canRedo: state.index < state.stack.length - 1
  }),
  subscribe: (listener: HistoryListener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  push: (entry: HistoryEntry): void => {
    const current = state;
    let nextStack: HistoryEntry[];
    let nextIndex: number;

    if (current.index < current.stack.length - 1) {
      // Truncate forward history before appending new entry
      nextStack = current.stack.slice(0, current.index + 1);
      nextIndex = current.index;
    } else {
      nextStack = [...current.stack];
      nextIndex = current.index;
    }

    nextStack.push(entry);
    nextIndex += 1;

    const trimmed = trimStack(nextStack, nextIndex);
    setState({ stack: trimmed.stack, index: trimmed.index });
  },
  undo: (): HistoryEntry | null => {
    if (state.index < 0) {
      return null;
    }
    const entry = state.stack[state.index];
    setState({ index: state.index - 1 });
    return entry;
  },
  redo: (): HistoryEntry | null => {
    if (state.index >= state.stack.length - 1) {
      return null;
    }
    const nextIndex = state.index + 1;
    const entry = state.stack[nextIndex];
    setState({ index: nextIndex });
    return entry;
  },
  clear: (): void => {
    setState({ stack: [], index: -1 });
  },
  adjustMaxSize: (): void => {
    const maxSize = getMaxSize();
    if (state.stack.length > maxSize) {
      const overflow = state.stack.length - maxSize;
      setState({
        stack: state.stack.slice(overflow),
        index: state.index - overflow
      });
    }
  }
};

export const useHistoryStore = <T,>(
  selector: (storeState: ReturnType<typeof historyStore.getState>) => T
): T => {
  return useSyncExternalStore(
    historyStore.subscribe,
    () => selector(historyStore.getState()),
    () => selector({ ...initialState, canUndo: false, canRedo: false })
  );
};

// Subscribe to maxUndoSteps changes to auto-trim history stack
settingsStore.subscribe(() => {
  historyStore.adjustMaxSize();
});

export type { HistoryEntry };
