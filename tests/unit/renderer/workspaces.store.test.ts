import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setBridge = (bridge: Record<string, unknown>): void => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      openweaveShell: {
        workspaces: bridge
      }
    }
  });
};

const importStore = async () => {
  vi.resetModules();
  return import('../../../src/renderer/features/workspaces/workspaces.store');
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('workspaces store', () => {
  beforeEach(() => {
    setBridge({
      listWorkspaces: vi.fn().mockResolvedValue({ workspaces: [] }),
      createWorkspace: vi.fn(),
      createBranchWorkspace: vi.fn(),
      openWorkspace: vi.fn(),
      deleteWorkspace: vi.fn(),
      listWorkspaceGroups: vi.fn().mockResolvedValue({ groups: [], uiState: [] }),
      createWorkspaceGroup: vi.fn(),
      deleteWorkspaceGroup: vi.fn(),
      setWorkspaceGroupCollapsed: vi.fn(),
      moveWorkspaceToGroup: vi.fn(),
      moveWorkspaceToUngrouped: vi.fn(),
      reorderUngroupedWorkspaces: vi.fn(),
      reorderWorkspaceGroups: vi.fn(),
      reorderGroupMembers: vi.fn()
    });
  });

  it('opens and closes dialogs and add menu', async () => {
    const { workspacesStore } = await importStore();

    workspacesStore.openCreateDialog();
    expect(workspacesStore.getState().isCreateDialogOpen).toBe(true);
    workspacesStore.closeCreateDialog();
    expect(workspacesStore.getState().isCreateDialogOpen).toBe(false);

    workspacesStore.openBranchDialog('ws-1');
    expect(workspacesStore.getState().isBranchDialogOpen).toBe(true);
    expect(workspacesStore.getState().branchSourceWorkspaceId).toBe('ws-1');
    workspacesStore.closeBranchDialog();
    expect(workspacesStore.getState().isBranchDialogOpen).toBe(false);

    workspacesStore.openAddMenu();
    expect(workspacesStore.getState().isAddMenuOpen).toBe(true);
    workspacesStore.closeAddMenu();
    expect(workspacesStore.getState().isAddMenuOpen).toBe(false);
  });

  it('loads, creates, opens, branches, and deletes workspaces through the bridge', async () => {
    const workspace = {
      id: 'ws-1',
      name: 'Workspace',
      rootDir: '/tmp/ws-1',
      createdAtMs: 1,
      updatedAtMs: 1,
      lastOpenedAtMs: null,
      groupId: null
    };
    const branchWorkspace = {
      ...workspace,
      id: 'ws-2',
      name: 'Workspace Branch'
    };
    const listWorkspaces = vi.fn().mockResolvedValue({ workspaces: [workspace] });
    const createWorkspace = vi.fn().mockResolvedValue({ workspace });
    const createBranchWorkspace = vi.fn().mockResolvedValue({ workspace: branchWorkspace });
    const openWorkspace = vi.fn().mockResolvedValue({ workspace });
    const deleteWorkspace = vi.fn().mockResolvedValue({ deleted: true });
    setBridge({
      listWorkspaces,
      createWorkspace,
      createBranchWorkspace,
      openWorkspace,
      deleteWorkspace,
      listWorkspaceGroups: vi.fn().mockResolvedValue({ groups: [], uiState: [] }),
      createWorkspaceGroup: vi.fn(),
      deleteWorkspaceGroup: vi.fn(),
      setWorkspaceGroupCollapsed: vi.fn(),
      moveWorkspaceToGroup: vi.fn(),
      moveWorkspaceToUngrouped: vi.fn(),
      reorderUngroupedWorkspaces: vi.fn(),
      reorderWorkspaceGroups: vi.fn(),
      reorderGroupMembers: vi.fn()
    });

    const { workspacesStore } = await importStore();

    await workspacesStore.loadWorkspaces();
    expect(workspacesStore.getState().workspaces).toEqual([workspace]);

    await workspacesStore.createWorkspace({
      name: 'Workspace',
      rootDir: '/tmp/ws-1'
    });
    expect(createWorkspace).toHaveBeenCalled();
    expect(workspacesStore.getState().activeWorkspaceId).toBe('ws-1');

    await workspacesStore.openWorkspace('ws-1');
    expect(openWorkspace).toHaveBeenCalledWith({ workspaceId: 'ws-1' });

    workspacesStore.openBranchDialog('ws-1');
    await workspacesStore.createBranchWorkspace({
      sourceWorkspaceId: 'ws-1',
      branchName: 'feature/demo',
      copyCanvas: true
    });
    expect(createBranchWorkspace).toHaveBeenCalled();
    expect(workspacesStore.getState().activeWorkspaceId).toBe('ws-2');

    await workspacesStore.deleteWorkspace('ws-2');
    expect(deleteWorkspace).toHaveBeenCalledWith({ workspaceId: 'ws-2' });
    expect(workspacesStore.getState().activeWorkspaceId).toBeNull();
  });

  it('loads groups and persists collapsed state', async () => {
    const listWorkspaceGroups = vi.fn().mockResolvedValue({
      groups: [
        {
          id: 'group-1',
          name: 'Backend',
          sortOrder: 0,
          createdAtMs: 1,
          updatedAtMs: 1
        }
      ],
      uiState: [
        {
          groupId: 'group-1',
          collapsed: false,
          updatedAtMs: 1
        }
      ]
    });
    const setWorkspaceGroupCollapsed = vi.fn().mockResolvedValue({
      groupId: 'group-1',
      collapsed: true,
      updatedAtMs: 2
    });

    setBridge({
      listWorkspaces: vi.fn().mockResolvedValue({ workspaces: [] }),
      createWorkspace: vi.fn(),
      createBranchWorkspace: vi.fn(),
      openWorkspace: vi.fn(),
      deleteWorkspace: vi.fn(),
      listWorkspaceGroups,
      createWorkspaceGroup: vi.fn(),
      deleteWorkspaceGroup: vi.fn(),
      setWorkspaceGroupCollapsed,
      moveWorkspaceToGroup: vi.fn(),
      moveWorkspaceToUngrouped: vi.fn(),
      reorderUngroupedWorkspaces: vi.fn(),
      reorderWorkspaceGroups: vi.fn(),
      reorderGroupMembers: vi.fn()
    });

    const { workspacesStore } = await importStore();

    await workspacesStore.loadWorkspaceGroups();
    expect(listWorkspaceGroups).toHaveBeenCalled();
    expect(workspacesStore.getState().groups).toHaveLength(1);

    await workspacesStore.setGroupCollapsed('group-1', true);
    expect(setWorkspaceGroupCollapsed).toHaveBeenCalledWith({ groupId: 'group-1', collapsed: true });
    expect(workspacesStore.getState().groupUiState['group-1']?.collapsed).toBe(true);
  });

  it('stores bridge errors and not-found delete responses', async () => {
    const listWorkspaces = vi.fn().mockRejectedValue(new Error('load failed'));
    const createWorkspace = vi.fn().mockRejectedValue(new Error('create failed'));
    const deleteWorkspace = vi.fn().mockResolvedValue({ deleted: false });
    setBridge({
      listWorkspaces,
      createWorkspace,
      createBranchWorkspace: vi.fn(),
      openWorkspace: vi.fn(),
      deleteWorkspace,
      listWorkspaceGroups: vi.fn().mockResolvedValue({ groups: [], uiState: [] }),
      createWorkspaceGroup: vi.fn(),
      deleteWorkspaceGroup: vi.fn(),
      setWorkspaceGroupCollapsed: vi.fn(),
      moveWorkspaceToGroup: vi.fn(),
      moveWorkspaceToUngrouped: vi.fn(),
      reorderUngroupedWorkspaces: vi.fn(),
      reorderWorkspaceGroups: vi.fn(),
      reorderGroupMembers: vi.fn()
    });

    const { workspacesStore } = await importStore();

    await workspacesStore.loadWorkspaces();
    expect(workspacesStore.getState().errorMessage).toBe('load failed');

    await workspacesStore.createWorkspace({
      name: 'Workspace',
      rootDir: '/tmp/ws-1'
    });
    expect(workspacesStore.getState().errorMessage).toBe('create failed');

    await workspacesStore.deleteWorkspace('missing');
    expect(workspacesStore.getState().errorMessage).toBe('Workspace not found');
  });
});

