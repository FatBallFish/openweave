import { useSyncExternalStore } from 'react';
import type {
  OpenWeaveShellBridge,
  WorkspaceGroupRecord,
  WorkspaceGroupUiStateRecord,
  WorkspaceRecord
} from '../../../shared/ipc/contracts';
import type {
  WorkspaceBranchCreateInput,
  WorkspaceCreateInput,
  WorkspaceUpdateInput
} from '../../../shared/ipc/schemas';

interface WorkspacesState {
  workspaces: WorkspaceRecord[];
  groups: WorkspaceGroupRecord[];
  groupUiState: Record<string, WorkspaceGroupUiStateRecord>;
  activeWorkspaceId: string | null;
  mountedWorkspaceIds: string[];
  loading: boolean;
  isCreateDialogOpen: boolean;
  isBranchDialogOpen: boolean;
  isAddMenuOpen: boolean;
  branchSourceWorkspaceId: string | null;
  errorMessage: string | null;
}

const initialState: WorkspacesState = {
  workspaces: [],
  groups: [],
  groupUiState: {},
  activeWorkspaceId: null,
  mountedWorkspaceIds: [],
  loading: false,
  isCreateDialogOpen: false,
  isBranchDialogOpen: false,
  isAddMenuOpen: false,
  branchSourceWorkspaceId: null,
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

const appendMountedWorkspaceId = (workspaceId: string): string[] => {
  const filtered = state.mountedWorkspaceIds.filter((mountedWorkspaceId) => mountedWorkspaceId !== workspaceId);
  return [workspaceId, ...filtered];
};

const toGroupUiStateMap = (entries: WorkspaceGroupUiStateRecord[]): Record<string, WorkspaceGroupUiStateRecord> => {
  const map: Record<string, WorkspaceGroupUiStateRecord> = {};
  for (const entry of entries) {
    map[entry.groupId] = entry;
  }
  return map;
};

const loadWorkspacesImpl = async (): Promise<void> => {
  setState({ loading: true, errorMessage: null });
  try {
    const result = await getBridge().listWorkspaces();
    const activeWorkspaceStillExists = result.workspaces.some(
      (workspace) => workspace.id === state.activeWorkspaceId
    );

    setState({
      workspaces: result.workspaces,
      loading: false,
      activeWorkspaceId: activeWorkspaceStillExists ? state.activeWorkspaceId : null,
      mountedWorkspaceIds: state.mountedWorkspaceIds.filter((workspaceId) =>
        result.workspaces.some((workspace) => workspace.id === workspaceId)
      )
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load workspaces';
    setState({ loading: false, errorMessage });
  }
};

const loadWorkspaceGroupsImpl = async (): Promise<void> => {
  setState({ loading: true, errorMessage: null });
  try {
    const result = await getBridge().listWorkspaceGroups();
    setState({
      groups: result.groups,
      groupUiState: toGroupUiStateMap(result.uiState),
      loading: false
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load workspace groups';
    setState({ loading: false, errorMessage });
  }
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
  openAddMenu: (): void => {
    setState({ isAddMenuOpen: true, errorMessage: null });
  },
  closeAddMenu: (): void => {
    setState({ isAddMenuOpen: false });
  },
  openBranchDialog: (sourceWorkspaceId: string): void => {
    setState({
      isBranchDialogOpen: true,
      branchSourceWorkspaceId: sourceWorkspaceId,
      errorMessage: null
    });
  },
  closeBranchDialog: (): void => {
    setState({
      isBranchDialogOpen: false,
      branchSourceWorkspaceId: null
    });
  },
  loadWorkspaces: loadWorkspacesImpl,
  loadWorkspaceGroups: loadWorkspaceGroupsImpl,
  setGroupCollapsed: async (groupId: string, collapsed: boolean): Promise<void> => {
    try {
      const result = await getBridge().setWorkspaceGroupCollapsed({ groupId, collapsed });
      setState({
        groupUiState: {
          ...state.groupUiState,
          [groupId]: result
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update group collapsed state';
      setState({ errorMessage });
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
        mountedWorkspaceIds: appendMountedWorkspaceId(result.workspace.id),
        isCreateDialogOpen: false
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create workspace';
      setState({ loading: false, errorMessage });
    }
  },
  createBranchWorkspace: async (input: WorkspaceBranchCreateInput): Promise<void> => {
    setState({ loading: true, errorMessage: null });
    try {
      const result = await getBridge().createBranchWorkspace(input);
      setState({
        loading: false,
        workspaces: upsertWorkspace(result.workspace),
        activeWorkspaceId: result.workspace.id,
        mountedWorkspaceIds: appendMountedWorkspaceId(result.workspace.id),
        isBranchDialogOpen: false,
        branchSourceWorkspaceId: null
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create branch workspace';
      setState({ loading: false, errorMessage });
    }
  },
  openWorkspace: async (workspaceId: string): Promise<void> => {
    setState({ loading: true, errorMessage: null });
    try {
      const result = await getBridge().openWorkspace({ workspaceId });
      setState({
        loading: false,
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === result.workspace.id ? result.workspace : workspace
        ),
        activeWorkspaceId: result.workspace.id,
        mountedWorkspaceIds: appendMountedWorkspaceId(result.workspace.id)
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
        activeWorkspaceId: nextActiveWorkspaceId,
        mountedWorkspaceIds: state.mountedWorkspaceIds.filter(
          (mountedWorkspaceId) => mountedWorkspaceId !== workspaceId
        ),
        branchSourceWorkspaceId:
          state.branchSourceWorkspaceId === workspaceId ? null : state.branchSourceWorkspaceId
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete workspace';
      setState({ loading: false, errorMessage });
    }
  },
  updateWorkspace: async (input: WorkspaceUpdateInput): Promise<void> => {
    setState({ loading: true, errorMessage: null });
    try {
      const bridge = getBridge();
      if (typeof bridge.updateWorkspace !== 'function') {
        throw new Error('Workspace editing is unavailable in this build');
      }
      const result = await bridge.updateWorkspace(input);
      setState({
        loading: false,
        workspaces: upsertWorkspace(result.workspace)
      });
      await loadWorkspacesImpl();
      await loadWorkspaceGroupsImpl();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update workspace';
      setState({ loading: false, errorMessage });
    }
  },
  pickDirectory: async (initialPath?: string): Promise<string | null> => {
    const bridge = getBridge();
    if (typeof bridge.pickWorkspaceDirectory !== 'function') {
      setState({ errorMessage: 'Directory picker is unavailable in this build' });
      return null;
    }

    try {
      const result = await bridge.pickWorkspaceDirectory(initialPath ? { initialPath } : {});
      return result.directory ?? null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to open directory picker';
      setState({ errorMessage });
      return null;
    }
  },
  revealDirectory: async (directory: string): Promise<boolean> => {
    const bridge = getBridge();
    if (typeof bridge.revealWorkspaceDirectory !== 'function') {
      setState({ errorMessage: 'File manager reveal is unavailable in this build' });
      return false;
    }

    try {
      await bridge.revealWorkspaceDirectory({ directory });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to open directory';
      setState({ errorMessage });
      return false;
    }
  },
  unmountWorkspace: (workspaceId: string): void => {
    const nextMountedWorkspaceIds = state.mountedWorkspaceIds.filter(
      (mountedWorkspaceId) => mountedWorkspaceId !== workspaceId
    );
    const nextActiveWorkspaceId =
      state.activeWorkspaceId === workspaceId ? nextMountedWorkspaceIds[0] ?? null : state.activeWorkspaceId;
    setState({
      mountedWorkspaceIds: nextMountedWorkspaceIds,
      activeWorkspaceId: nextActiveWorkspaceId
    });
  },
  mountWorkspace: (workspaceId: string): void => {
    setState({
      mountedWorkspaceIds: appendMountedWorkspaceId(workspaceId)
    });
  },
  createWorkspaceGroup: async (name: string): Promise<void> => {
    setState({ loading: true, errorMessage: null });
    try {
      const result = await getBridge().createWorkspaceGroup({ name });
      setState({
        loading: false,
        groups: [...state.groups, result.group]
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create workspace group';
      setState({ loading: false, errorMessage });
    }
  },
  updateWorkspaceGroup: async (groupId: string, name: string): Promise<void> => {
    setState({ loading: true, errorMessage: null });
    try {
      const result = await getBridge().updateWorkspaceGroup({ groupId, name });
      setState({
        loading: false,
        groups: state.groups.map((group) => (group.id === result.group.id ? result.group : group))
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update workspace group';
      setState({ loading: false, errorMessage });
    }
  },
  deleteWorkspaceGroup: async (groupId: string): Promise<void> => {
    setState({ loading: true, errorMessage: null });
    try {
      await getBridge().deleteWorkspaceGroup({ groupId });
      setState({
        loading: false,
        groups: state.groups.filter((group) => group.id !== groupId)
      });
      await loadWorkspacesImpl();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete workspace group';
      setState({ loading: false, errorMessage });
    }
  },
  moveWorkspaceToGroup: async (workspaceId: string, groupId: string, targetIndex: number): Promise<void> => {
    setState({ loading: true, errorMessage: null });
    try {
      await getBridge().moveWorkspaceToGroup({ workspaceId, groupId, targetIndex });
      setState({ loading: false });
      await loadWorkspacesImpl();
      await loadWorkspaceGroupsImpl();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to move workspace to group';
      setState({ loading: false, errorMessage });
    }
  },
  moveWorkspaceToUngrouped: async (workspaceId: string, targetIndex: number): Promise<void> => {
    setState({ loading: true, errorMessage: null });
    try {
      await getBridge().moveWorkspaceToUngrouped({ workspaceId, targetIndex });
      setState({ loading: false });
      await loadWorkspacesImpl();
      await loadWorkspaceGroupsImpl();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to move workspace to ungrouped';
      setState({ loading: false, errorMessage });
    }
  },
  reorderUngroupedWorkspaces: async (workspaceIds: string[]): Promise<void> => {
    setState({ loading: true, errorMessage: null });
    try {
      await getBridge().reorderUngroupedWorkspaces({ workspaceIds });
      setState({ loading: false });
      await loadWorkspacesImpl();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reorder ungrouped workspaces';
      setState({ loading: false, errorMessage });
    }
  },
  reorderWorkspaceGroups: async (groupIds: string[]): Promise<void> => {
    setState({ loading: true, errorMessage: null });
    try {
      await getBridge().reorderWorkspaceGroups({ groupIds });
      setState({ loading: false });
      await loadWorkspaceGroupsImpl();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reorder workspace groups';
      setState({ loading: false, errorMessage });
    }
  },
  reorderGroupMembers: async (groupId: string, workspaceIds: string[]): Promise<void> => {
    setState({ loading: true, errorMessage: null });
    try {
      await getBridge().reorderGroupMembers({ groupId, workspaceIds });
      setState({ loading: false });
      await loadWorkspacesImpl();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reorder group members';
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
