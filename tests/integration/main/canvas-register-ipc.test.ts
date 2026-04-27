import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { IPC_CHANNELS } from '../../../src/shared/ipc/contracts';
import { createRegistryRepository } from '../../../src/main/db/registry';
import {
  disposeCanvasIpcHandlers,
  disposeCanvasWorkspaceRepository,
  registerCanvasIpcHandlers
} from '../../../src/main/ipc/canvas';

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

  public async invoke(channel: string, payload: unknown): Promise<any> {
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
  disposeCanvasIpcHandlers();
  while (createdPaths.length > 0) {
    fs.rmSync(createdPaths.pop()!, { recursive: true, force: true });
  }
});

describe('registered canvas IPC handlers', () => {
  it('registers handlers, sanitizes roots, rotates repository cache, and resets context on db changes', async () => {
    const ipcMain = new IpcMainStub();
    const firstDir = mkdtemp('openweave-canvas-registered-a-');
    const firstRegistryPath = path.join(firstDir, 'registry.sqlite');
    const firstWorkspaceDbDir = path.join(firstDir, 'workspaces');
    fs.mkdirSync(firstWorkspaceDbDir, { recursive: true });
    const firstRegistry = createRegistryRepository({ dbFilePath: firstRegistryPath });

    const workspaceIds: string[] = [];
    for (let index = 0; index < 26; index += 1) {
      const rootDir = path.join(firstDir, `workspace-${index}`);
      fs.mkdirSync(rootDir, { recursive: true });
      workspaceIds.push(
        firstRegistry.createWorkspace({
          name: `Workspace ${index}`,
          rootDir
        }).id
      );
    }
    firstRegistry.close();

    registerCanvasIpcHandlers({
      workspaceDbDir: firstWorkspaceDbDir,
      registryDbFilePath: firstRegistryPath,
      ipcMain
    });

    expect(ipcMain.removed).toEqual([
      IPC_CHANNELS.canvasLoad,
      IPC_CHANNELS.canvasSave,
      IPC_CHANNELS.graphLoad,
      IPC_CHANNELS.graphSave,
      IPC_CHANNELS.noteFileCreate,
      IPC_CHANNELS.noteFileRead,
      IPC_CHANNELS.noteFileWrite,
      IPC_CHANNELS.noteFileDelete,
      IPC_CHANNELS.noteFileRename
    ]);

    await ipcMain.invoke(IPC_CHANNELS.canvasSave, {
      workspaceId: workspaceIds[0],
      state: {
        nodes: [
          {
            id: 'tree-1',
            type: 'file-tree',
            x: 0,
            y: 0,
            rootDir: '/tmp/outside-root'
          }
        ],
        edges: []
      }
    });

    for (const workspaceId of workspaceIds.slice(1)) {
      await ipcMain.invoke(IPC_CHANNELS.canvasSave, {
        workspaceId,
        state: {
          nodes: [{ id: `note-${workspaceId}`, type: 'note', x: 1, y: 2, contentMd: workspaceId }],
          edges: []
        }
      });
    }

    disposeCanvasWorkspaceRepository(workspaceIds[0]);
    const restored = await ipcMain.invoke(IPC_CHANNELS.canvasLoad, {
      workspaceId: workspaceIds[0]
    });
    expect(restored.state.nodes[0].rootDir).toBe(fs.realpathSync(path.join(firstDir, 'workspace-0')));

    const secondDir = mkdtemp('openweave-canvas-registered-b-');
    const secondRegistryPath = path.join(secondDir, 'registry.sqlite');
    const secondWorkspaceDbDir = path.join(secondDir, 'workspaces');
    fs.mkdirSync(secondWorkspaceDbDir, { recursive: true });
    const secondRegistry = createRegistryRepository({ dbFilePath: secondRegistryPath });
    const secondRootDir = path.join(secondDir, 'workspace-root');
    fs.mkdirSync(secondRootDir, { recursive: true });
    const secondWorkspaceId = secondRegistry.createWorkspace({
      name: 'Workspace B',
      rootDir: secondRootDir
    }).id;
    secondRegistry.close();

    registerCanvasIpcHandlers({
      workspaceDbDir: secondWorkspaceDbDir,
      registryDbFilePath: secondRegistryPath,
      ipcMain
    });

    await ipcMain.invoke(IPC_CHANNELS.canvasSave, {
      workspaceId: secondWorkspaceId,
      state: {
        nodes: [{ id: 'note-b', type: 'note', x: 9, y: 9, contentMd: 'b' }],
        edges: []
      }
    });
    const secondLoaded = await ipcMain.invoke(IPC_CHANNELS.canvasLoad, {
      workspaceId: secondWorkspaceId
    });
    expect(secondLoaded.state.nodes[0]).toMatchObject({ id: 'note-b', contentMd: 'b' });

    await ipcMain.invoke(IPC_CHANNELS.graphSave, {
      workspaceId: secondWorkspaceId,
      graphSnapshot: {
        schemaVersion: 2,
        nodes: [
          {
            id: 'graph-file-tree-1',
            componentType: 'builtin.file-tree',
            componentVersion: '1.0.0',
            title: 'Repo',
            bounds: {
              x: 12,
              y: 16,
              width: 360,
              height: 280
            },
            config: {
              rootDir: '/tmp/outside-root'
            },
            state: {},
            capabilities: ['read', 'listChildren'],
            createdAtMs: 10,
            updatedAtMs: 11
          }
        ],
        edges: []
      }
    });

    const graphLoaded = await ipcMain.invoke(IPC_CHANNELS.graphLoad, {
      workspaceId: secondWorkspaceId
    });
    expect(graphLoaded.graphSnapshot.nodes[0]).toMatchObject({
      id: 'graph-file-tree-1',
      componentType: 'builtin.file-tree',
      config: {
        rootDir: fs.realpathSync(secondRootDir)
      }
    });
  });
});
