import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '../../../src/shared/ipc/contracts';
import { createRegistryRepository } from '../../../src/main/db/registry';

type StubPortalManager = {
  loadUrl: (portalId: string, url: string) => Promise<void>;
  capture: (portalId: string, workspaceId: string, nodeId: string) => Promise<{ path: string; takenAtMs: number }>;
  readStructure: (portalId: string) => Promise<{ elements: Array<{ tag: string; text: string }> }>;
  click: (portalId: string, selector: string) => Promise<void>;
  input: (portalId: string, selector: string, value: string) => Promise<void>;
  disposePortal: (portalId: string) => void;
  dispose: () => void;
  disposePortalIds: string[];
  disposed: boolean;
  artifactsRootDir: string;
};

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
  vi.restoreAllMocks();
  vi.resetModules();
  while (createdPaths.length > 0) {
    fs.rmSync(createdPaths.pop()!, { recursive: true, force: true });
  }
});

describe('registered portal IPC handlers', () => {
  it('registers portal handlers, disposes workspace state, and recreates context when configuration changes', async () => {
    const managers: StubPortalManager[] = [];

    vi.doMock('../../../src/main/portal/portal-manager', () => {
      return {
        createPortalManager: ({ artifactsRootDir }: { artifactsRootDir: string }) => {
          const manager: StubPortalManager = {
            artifactsRootDir,
            disposePortalIds: [],
            disposed: false,
            async loadUrl() {},
            async capture(portalId: string, workspaceId: string, nodeId: string) {
              return {
                path: path.join(artifactsRootDir, workspaceId, nodeId, `${portalId}.png`),
                takenAtMs: 123
              };
            },
            async readStructure() {
              return { elements: [{ tag: 'button', text: 'go' }] };
            },
            async click() {},
            async input() {},
            disposePortal(portalId: string) {
              manager.disposePortalIds.push(portalId);
            },
            dispose() {
              manager.disposed = true;
            }
          };
          managers.push(manager);
          return manager;
        }
      };
    });

    const {
      disposePortalIpcHandlers,
      disposePortalWorkspaceState,
      registerPortalIpcHandlers
    } = await import('../../../src/main/ipc/portal');

    const ipcMain = new IpcMainStub();
    const firstDir = mkdtemp('openweave-portal-registered-a-');
    const firstDbPath = path.join(firstDir, 'registry.sqlite');
    const firstArtifactsRoot = path.join(firstDir, 'artifacts', 'portal');
    const registry = createRegistryRepository({ dbFilePath: firstDbPath });
    const workspaceRoot = path.join(firstDir, 'workspace-root');
    fs.mkdirSync(workspaceRoot, { recursive: true });
    const workspace = registry.createWorkspace({
      name: 'Workspace A',
      rootDir: workspaceRoot
    });
    registry.close();

    registerPortalIpcHandlers({
      dbFilePath: firstDbPath,
      artifactsRootDir: firstArtifactsRoot,
      ipcMain
    });

    expect(ipcMain.removed).toEqual([
      IPC_CHANNELS.portalLoad,
      IPC_CHANNELS.portalCapture,
      IPC_CHANNELS.portalReadStructure,
      IPC_CHANNELS.portalClick,
      IPC_CHANNELS.portalInput
    ]);

    const loaded = await ipcMain.invoke(IPC_CHANNELS.portalLoad, {
      workspaceId: workspace.id,
      nodeId: 'portal-1',
      url: 'https://example.com'
    });
    const portalId = loaded.portal.id;

    const capture = await ipcMain.invoke(IPC_CHANNELS.portalCapture, {
      workspaceId: workspace.id,
      portalId
    });
    expect(capture.screenshot.path).toContain(path.join(workspace.id, 'portal-1'));

    await ipcMain.invoke(IPC_CHANNELS.portalReadStructure, {
      workspaceId: workspace.id,
      portalId
    });
    await ipcMain.invoke(IPC_CHANNELS.portalClick, {
      workspaceId: workspace.id,
      portalId,
      selector: '#submit'
    });
    await ipcMain.invoke(IPC_CHANNELS.portalInput, {
      workspaceId: workspace.id,
      portalId,
      selector: '#message',
      value: 'hello'
    });

    const workspaceArtifactsDir = path.join(firstArtifactsRoot, workspace.id);
    fs.mkdirSync(workspaceArtifactsDir, { recursive: true });
    fs.writeFileSync(path.join(workspaceArtifactsDir, 'capture.png'), 'png');
    disposePortalWorkspaceState(workspace.id);
    expect(managers[0].disposePortalIds).toContain(portalId);
    expect(fs.existsSync(workspaceArtifactsDir)).toBe(false);

    const secondDir = mkdtemp('openweave-portal-registered-b-');
    const secondDbPath = path.join(secondDir, 'registry.sqlite');
    const secondArtifactsRoot = path.join(secondDir, 'artifacts', 'portal');
    const secondRegistry = createRegistryRepository({ dbFilePath: secondDbPath });
    const secondWorkspaceRoot = path.join(secondDir, 'workspace-root');
    fs.mkdirSync(secondWorkspaceRoot, { recursive: true });
    const secondWorkspace = secondRegistry.createWorkspace({
      name: 'Workspace B',
      rootDir: secondWorkspaceRoot
    });
    secondRegistry.close();

    registerPortalIpcHandlers({
      dbFilePath: secondDbPath,
      artifactsRootDir: secondArtifactsRoot,
      ipcMain
    });
    expect(managers[0].disposed).toBe(true);

    const loadedSecond = await ipcMain.invoke(IPC_CHANNELS.portalLoad, {
      workspaceId: secondWorkspace.id,
      nodeId: 'portal-2',
      url: 'https://example.org'
    });
    expect(loadedSecond.portal.workspaceId).toBe(secondWorkspace.id);

    disposePortalIpcHandlers();
    expect(managers.at(-1)?.disposed).toBe(true);
  });
});
