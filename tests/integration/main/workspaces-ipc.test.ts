import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { IpcMainInvokeEvent } from 'electron';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createWorkspaceIpcHandlers,
  type WorkspaceIpcHandlers
} from '../../../src/main/ipc/workspaces';
import { createRegistryRepository, type RegistryRepository } from '../../../src/main/db/registry';

let testDbDir = '';
let registry: RegistryRepository;
let handlers: WorkspaceIpcHandlers;
let deletedWorkspaceIds: string[] = [];

beforeEach(() => {
  testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-workspaces-ipc-'));
  deletedWorkspaceIds = [];
  registry = createRegistryRepository({
    dbFilePath: path.join(testDbDir, 'registry.sqlite')
  });
  handlers = createWorkspaceIpcHandlers({
    registry,
    onWorkspaceDeleted: (workspaceId: string) => {
      deletedWorkspaceIds.push(workspaceId);
    }
  });
});

afterEach(() => {
  registry.close();
  fs.rmSync(testDbDir, { recursive: true, force: true });
});

describe('workspace IPC flow', () => {
  it('creates a workspace row and returns it in the list', async () => {
    const suffix = Date.now();
    const result = await handlers.create({} as IpcMainInvokeEvent, {
      name: `Demo-${suffix}`,
      rootDir: `/tmp/demo-${suffix}`
    });
    expect(result.workspace.name).toBe(`Demo-${suffix}`);
    expect(handlers.list({} as IpcMainInvokeEvent).workspaces[0].rootDir).toBe(`/tmp/demo-${suffix}`);
  });

  it('updates last opened timestamp on open', async () => {
    const suffix = Date.now();
    const result = await handlers.create({} as IpcMainInvokeEvent, {
      name: `Opened-${suffix}`,
      rootDir: `/tmp/opened-${suffix}`
    });

    expect(result.workspace.lastOpenedAtMs).toBeNull();

    const opened = await handlers.open({} as IpcMainInvokeEvent, {
      workspaceId: result.workspace.id
    });
    expect(opened.workspace.lastOpenedAtMs).toBeTypeOf('number');
  });

  it('deletes a workspace row', async () => {
    const suffix = Date.now();
    const result = await handlers.create({} as IpcMainInvokeEvent, {
      name: `Deleted-${suffix}`,
      rootDir: `/tmp/deleted-${suffix}`
    });

    const removed = await handlers.delete({} as IpcMainInvokeEvent, {
      workspaceId: result.workspace.id
    });
    expect(removed.deleted).toBe(true);
    expect(deletedWorkspaceIds).toEqual([result.workspace.id]);
    expect(
      handlers
        .list({} as IpcMainInvokeEvent)
        .workspaces.find((workspace) => workspace.id === result.workspace.id)
    ).toBeUndefined();
  });

  it('does not emit delete callback when the workspace does not exist', async () => {
    const removed = await handlers.delete({} as IpcMainInvokeEvent, {
      workspaceId: 'missing-workspace'
    });

    expect(removed.deleted).toBe(false);
    expect(deletedWorkspaceIds).toEqual([]);
  });
});
