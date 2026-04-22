import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '../../../src/shared/ipc/contracts';
import {
  disposeWorkspaceIpcHandlers,
  registerWorkspaceIpcHandlers
} from '../../../src/main/ipc/workspaces';

class IpcMainStub {
  public readonly handlers = new Map<string, (...args: any[]) => unknown>();
  public readonly removed: string[] = [];

  public handle(channel: string, listener: (...args: any[]) => unknown): void {
    this.handlers.set(channel, listener);
  }

  public removeHandler(channel: string): void {
    this.removed.push(channel);
    this.handlers.delete(channel);
  }

  public async invoke(channel: string, payload?: unknown): Promise<any> {
    const handler = this.handlers.get(channel);
    if (!handler) {
      throw new Error(`IPC handler not registered: ${channel}`);
    }
    return handler({}, payload);
  }
}

const createdPaths: string[] = [];

const mkdtemp = (prefix: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  createdPaths.push(dir);
  return dir;
};

afterEach(() => {
  disposeWorkspaceIpcHandlers();
  vi.restoreAllMocks();
  while (createdPaths.length > 0) {
    fs.rmSync(createdPaths.pop()!, { recursive: true, force: true });
  }
});

describe('registered workspace IPC handlers', () => {
  it('registers create/list/open/delete handlers and switches registry files cleanly', async () => {
    const ipcMain = new IpcMainStub();
    const firstDbDir = mkdtemp('openweave-workspaces-registered-a-');
    const secondDbDir = mkdtemp('openweave-workspaces-registered-b-');
    const createdIds: string[] = [];
    const openedIds: string[] = [];
    const deletingIds: string[] = [];
    const deletedIds: string[] = [];

    const firstRoot = path.join(firstDbDir, 'workspace-root');
    fs.mkdirSync(firstRoot, { recursive: true });

    registerWorkspaceIpcHandlers({
      dbFilePath: path.join(firstDbDir, 'registry.sqlite'),
      ipcMain,
      onWorkspaceCreated: async (workspaceId: string) => {
        createdIds.push(workspaceId);
      },
      onWorkspaceOpened: async (workspaceId: string) => {
        openedIds.push(workspaceId);
      },
      onWorkspaceDeleting: async (workspace) => {
        deletingIds.push(workspace.id);
      },
      onWorkspaceDeleted: (workspaceId: string) => {
        deletedIds.push(workspaceId);
      }
    });

    expect(ipcMain.removed).toEqual([
      IPC_CHANNELS.workspaceCreate,
      IPC_CHANNELS.workspaceList,
      IPC_CHANNELS.workspaceOpen,
      IPC_CHANNELS.workspaceDelete,
      IPC_CHANNELS.workspaceUpdate,
      IPC_CHANNELS.workspacePickDirectory,
      IPC_CHANNELS.workspaceRevealDirectory,
      IPC_CHANNELS.workspaceGroupList,
      IPC_CHANNELS.workspaceGroupCreate,
      IPC_CHANNELS.workspaceGroupUpdate,
      IPC_CHANNELS.workspaceGroupDelete,
      IPC_CHANNELS.workspaceGroupCollapseSet,
      IPC_CHANNELS.workspaceMoveToGroup,
      IPC_CHANNELS.workspaceMoveToUngrouped,
      IPC_CHANNELS.workspaceReorderUngrouped,
      IPC_CHANNELS.workspaceReorderGroups,
      IPC_CHANNELS.workspaceReorderGroupMembers
    ]);

    expect(IPC_CHANNELS.workspaceGroupList).toBe('workspace-group:list');
    expect(IPC_CHANNELS.workspaceGroupCreate).toBe('workspace-group:create');
    expect(IPC_CHANNELS.workspaceGroupUpdate).toBe('workspace-group:update');
    expect(IPC_CHANNELS.workspaceGroupDelete).toBe('workspace-group:delete');
    expect(IPC_CHANNELS.workspaceGroupCollapseSet).toBe('workspace-group:set-collapsed');
    expect(IPC_CHANNELS.workspaceMoveToGroup).toBe('workspace:move-to-group');
    expect(IPC_CHANNELS.workspaceMoveToUngrouped).toBe('workspace:move-to-ungrouped');
    expect(IPC_CHANNELS.workspaceReorderUngrouped).toBe('workspace:reorder-ungrouped');
    expect(IPC_CHANNELS.workspaceReorderGroups).toBe('workspace-group:reorder');
    expect(IPC_CHANNELS.workspaceReorderGroupMembers).toBe('workspace-group:reorder-members');

    const created = await ipcMain.invoke(IPC_CHANNELS.workspaceCreate, {
      name: 'Workspace A',
      rootDir: firstRoot
    });
    expect(created.workspace.rootDir).toBe(fs.realpathSync(firstRoot));
    expect(createdIds).toEqual([created.workspace.id]);


    const groupCreated = await ipcMain.invoke(IPC_CHANNELS.workspaceGroupCreate, {
      name: 'Infra'
    });
    expect(groupCreated.group.name).toBe('Infra');

    const opened = await ipcMain.invoke(IPC_CHANNELS.workspaceOpen, {
      workspaceId: created.workspace.id
    });
    expect(opened.workspace.lastOpenedAtMs).toBeTypeOf('number');
    expect(openedIds).toEqual([created.workspace.id]);

    const removed = await ipcMain.invoke(IPC_CHANNELS.workspaceDelete, {
      workspaceId: created.workspace.id
    });
    expect(removed).toEqual({ deleted: true });
    expect(deletingIds).toEqual([created.workspace.id]);
    expect(deletedIds).toEqual([created.workspace.id]);

    const secondRoot = path.join(secondDbDir, 'workspace-root');
    fs.mkdirSync(secondRoot, { recursive: true });
    registerWorkspaceIpcHandlers({
      dbFilePath: path.join(secondDbDir, 'registry.sqlite'),
      ipcMain
    });

    const emptyList = await ipcMain.invoke(IPC_CHANNELS.workspaceList);
    expect(emptyList.workspaces).toEqual([]);

    const createdSecond = await ipcMain.invoke(IPC_CHANNELS.workspaceCreate, {
      name: 'Workspace B',
      rootDir: secondRoot
    });
    expect(createdSecond.workspace.name).toBe('Workspace B');
  });
});
