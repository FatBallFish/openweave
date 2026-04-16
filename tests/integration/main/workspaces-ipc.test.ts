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
  const createWorkspaceRootDir = (name: string): string => {
    const rootDir = path.join(testDbDir, name);
    fs.mkdirSync(rootDir, { recursive: true });
    return rootDir;
  };

  it('creates a workspace row and returns it in the list', async () => {
    const suffix = Date.now();
    const rootDir = createWorkspaceRootDir(`demo-${suffix}`);
    const result = await handlers.create({} as IpcMainInvokeEvent, {
      name: `Demo-${suffix}`,
      rootDir
    });
    expect(result.workspace.name).toBe(`Demo-${suffix}`);
    expect(handlers.list({} as IpcMainInvokeEvent).workspaces[0].rootDir).toBe(fs.realpathSync(rootDir));
  });

  it('updates last opened timestamp on open', async () => {
    const suffix = Date.now();
    const rootDir = createWorkspaceRootDir(`opened-${suffix}`);
    const result = await handlers.create({} as IpcMainInvokeEvent, {
      name: `Opened-${suffix}`,
      rootDir
    });

    expect(result.workspace.lastOpenedAtMs).toBeNull();

    const opened = await handlers.open({} as IpcMainInvokeEvent, {
      workspaceId: result.workspace.id
    });
    expect(opened.workspace.lastOpenedAtMs).toBeTypeOf('number');
  });

  it('deletes a workspace row', async () => {
    const suffix = Date.now();
    const rootDir = createWorkspaceRootDir(`deleted-${suffix}`);
    const result = await handlers.create({} as IpcMainInvokeEvent, {
      name: `Deleted-${suffix}`,
      rootDir
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

  it('rejects workspace creation when root directory does not exist', async () => {
    const missingRoot = path.join(testDbDir, 'missing-root');
    await expect(
      handlers.create({} as IpcMainInvokeEvent, {
        name: 'Invalid Root',
        rootDir: missingRoot
      })
    ).rejects.toThrow();
  });

  it('rejects workspace creation when root path points to a file', async () => {
    const fileRoot = path.join(testDbDir, 'workspace-root.txt');
    fs.writeFileSync(fileRoot, 'not a directory\n');

    await expect(
      handlers.create({} as IpcMainInvokeEvent, {
        name: 'Invalid File Root',
        rootDir: fileRoot
      })
    ).rejects.toThrow();
  });

  it('stores workspace root as canonical existing directory path', async () => {
    const canonicalRoot = fs.mkdtempSync(path.join(testDbDir, 'canonical-root-'));
    const nonCanonicalInput = path.join(canonicalRoot, '..', path.basename(canonicalRoot));

    const created = await handlers.create({} as IpcMainInvokeEvent, {
      name: 'Canonical Root',
      rootDir: nonCanonicalInput
    });

    expect(created.workspace.rootDir).toBe(fs.realpathSync(canonicalRoot));
  });
});
