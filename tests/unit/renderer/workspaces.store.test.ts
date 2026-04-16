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
      deleteWorkspace: vi.fn()
    });
  });

  it('opens and closes dialogs', async () => {
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
  });

  it('loads, creates, opens, branches, and deletes workspaces through the bridge', async () => {
    const workspace = {
      id: 'ws-1',
      name: 'Workspace',
      rootDir: '/tmp/ws-1',
      createdAtMs: 1,
      updatedAtMs: 1,
      lastOpenedAtMs: null
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
      deleteWorkspace
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

  it('stores bridge errors and not-found delete responses', async () => {
    const listWorkspaces = vi.fn().mockRejectedValue(new Error('load failed'));
    const createWorkspace = vi.fn().mockRejectedValue(new Error('create failed'));
    const deleteWorkspace = vi.fn().mockResolvedValue({ deleted: false });
    setBridge({
      listWorkspaces,
      createWorkspace,
      createBranchWorkspace: vi.fn(),
      openWorkspace: vi.fn(),
      deleteWorkspace
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
