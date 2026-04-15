import { useSyncExternalStore } from 'react';
import type { OpenWeaveShellBridge, WorkspaceRecord } from '../../../shared/ipc/contracts';
import type { WorkspaceCreateInput } from '../../../shared/ipc/schemas';

interface WorkspacesState {
  workspaces: WorkspaceRecord[];
  activeWorkspaceId: string | null;
  loading: boolean;
  isCreateDialogOpen: boolean;
  errorMessage: string | null;
}

const initialState: WorkspacesState = {
  workspaces: [],
  activeWorkspaceId: null,
  loading: false,
  isCreateDialogOpen: false,
  errorMessage: null
};

type StateListener = () => void;

let state: WorkspacesState = initialState;
const listeners = new Set<StateListener>();

const setState = (nextState: Partial<WorkspacesState>): void => {
  state = { ...state, ...nextState };
  for (const listener of listeners) {
    listener();
  }
};

const getBridge = (): OpenWeaveShellBridge['workspaces'] => {
  const shell = (window as Window & { openweaveShell?: OpenWeaveShellBridge }).openweaveShell;
  if (!shell) {
    throw new Error('openweaveShell bridge is unavailable');
  }
  return shell.workspaces;
};

const upsertWorkspace = (workspace: WorkspaceRecord): WorkspaceRecord[] => {
  const remaining = state.workspaces.filter((item) => item.id !== workspace.id);
  return [workspace, ...remaining];
};

export const workspacesStore = {
  getState: (): WorkspacesState => state,
  subscribe: (listener: StateListener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  openCreateDialog: (): void => {
    setState({ isCreateDialogOpen: true, errorMessage: null });
  },
  closeCreateDialog: (): void => {
    setState({ isCreateDialogOpen: false });
  },
  loadWorkspaces: async (): Promise<void> => {
    setState({ loading: true, errorMessage: null });
    try {
      const result = await getBridge().listWorkspaces();
      const activeWorkspaceStillExists = result.workspaces.some(
        (workspace) => workspace.id === state.activeWorkspaceId
      );

      setState({
        workspaces: result.workspaces,
        loading: false,
        activeWorkspaceId: activeWorkspaceStillExists ? state.activeWorkspaceId : null
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load workspaces';
      setState({ loading: false, errorMessage });
    }
  },
  createWorkspace: async (input: WorkspaceCreateInput): Promise<void> => {
    setState({ loading: true, errorMessage: null });
    try {
      const result = await getBridge().createWorkspace(input);
      setState({
        loading: false,
        workspaces: upsertWorkspace(result.workspace),
        activeWorkspaceId: result.workspace.id,
        isCreateDialogOpen: false
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create workspace';
      setState({ loading: false, errorMessage });
    }
  },
  openWorkspace: async (workspaceId: string): Promise<void> => {
    setState({ loading: true, errorMessage: null });
    try {
      const result = await getBridge().openWorkspace({ workspaceId });
      setState({
        loading: false,
        workspaces: upsertWorkspace(result.workspace),
        activeWorkspaceId: result.workspace.id
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to open workspace';
      setState({ loading: false, errorMessage });
    }
  },
  deleteWorkspace: async (workspaceId: string): Promise<void> => {
    setState({ loading: true, errorMessage: null });
    try {
      const result = await getBridge().deleteWorkspace({ workspaceId });
      if (!result.deleted) {
        setState({ loading: false, errorMessage: 'Workspace not found' });
        return;
      }

      const nextActiveWorkspaceId =
        state.activeWorkspaceId === workspaceId ? null : state.activeWorkspaceId;
      setState({
        loading: false,
        workspaces: state.workspaces.filter((workspace) => workspace.id !== workspaceId),
        activeWorkspaceId: nextActiveWorkspaceId
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete workspace';
      setState({ loading: false, errorMessage });
    }
  }
};

export const useWorkspacesStore = <T,>(selector: (storeState: WorkspacesState) => T): T => {
  return useSyncExternalStore(
    workspacesStore.subscribe,
    () => selector(workspacesStore.getState()),
    () => selector(initialState)
  );
};
