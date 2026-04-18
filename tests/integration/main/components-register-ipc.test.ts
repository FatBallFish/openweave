import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { IPC_CHANNELS } from '../../../src/shared/ipc/contracts';
import { createComponentRegistry } from '../../../src/main/components/component-registry';
import { createRegistryRepository } from '../../../src/main/db/registry';
import {
  disposeComponentsIpcHandlers,
  registerComponentsIpcHandlers
} from '../../../src/main/ipc/components';

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

const createManifest = (overrides: Record<string, unknown> = {}) => ({
  manifestVersion: 1,
  name: 'external.note',
  version: '1.0.0',
  displayName: 'External Note',
  category: 'knowledge',
  kind: 'external',
  description: 'External note component',
  entry: {
    renderer: 'renderer/index.js',
    worker: 'worker/index.js'
  },
  node: {
    defaultTitle: 'Note',
    defaultSize: {
      width: 320,
      height: 200
    }
  },
  schema: {
    config: {
      type: 'object'
    },
    state: {
      type: 'object'
    }
  },
  capabilities: ['read'],
  actions: [
    {
      name: 'read',
      description: 'Read note',
      inputSchema: 'schemas/action.read.input.json',
      outputSchema: 'schemas/action.read.output.json',
      idempotent: true
    }
  ],
  permissions: {
    fs: 'none',
    network: 'none',
    process: 'none'
  },
  compatibility: {
    openweave: '>=0.1.0',
    platforms: [process.platform]
  },
  ...overrides
});

const createPackageRoot = (rootDir: string, manifestOverrides: Record<string, unknown> = {}): string => {
  fs.mkdirSync(path.join(rootDir, 'renderer'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'worker'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'renderer', 'index.js'), 'export {}\n');
  fs.writeFileSync(path.join(rootDir, 'worker', 'index.js'), 'export {}\n');
  fs.writeFileSync(
    path.join(rootDir, 'component.json'),
    JSON.stringify(createManifest(manifestOverrides), null, 2)
  );
  return rootDir;
};

afterEach(() => {
  disposeComponentsIpcHandlers();
  while (createdPaths.length > 0) {
    fs.rmSync(createdPaths.pop()!, { recursive: true, force: true });
  }
});

describe('registered components IPC handlers', () => {
  it('registers list/install/uninstall handlers and preserves fallback semantics for external uninstall', async () => {
    const ipcMain = new IpcMainStub();
    const testDir = mkdtemp('openweave-components-registered-');
    const dbFilePath = path.join(testDir, 'registry.sqlite');
    const installRoot = path.join(testDir, 'installed-components');
    const sourceRoot = createPackageRoot(path.join(testDir, 'source-component'));

    registerComponentsIpcHandlers({
      dbFilePath,
      installRoot,
      ipcMain,
      appVersion: '0.1.0'
    });

    expect(ipcMain.removed).toEqual([
      IPC_CHANNELS.componentList,
      IPC_CHANNELS.componentInstall,
      IPC_CHANNELS.componentUninstall
    ]);

    const installed = await ipcMain.invoke(IPC_CHANNELS.componentInstall, {
      sourceType: 'directory',
      sourcePath: sourceRoot
    });
    expect(installed.component).toMatchObject({
      componentId: 'external.note@1.0.0',
      name: 'external.note',
      version: '1.0.0',
      sourceType: 'directory'
    });

    const listed = await ipcMain.invoke(IPC_CHANNELS.componentList, {});
    expect(listed.components).toEqual([
      expect.objectContaining({
        name: 'external.note',
        version: '1.0.0',
        displayName: 'External Note',
        builtin: false,
        installed: true
      })
    ]);

    const uninstalled = await ipcMain.invoke(IPC_CHANNELS.componentUninstall, {
      name: 'external.note'
    });
    expect(uninstalled).toEqual({
      name: 'external.note',
      version: '1.0.0',
      uninstalled: true,
      fallbackRequired: true
    });

    const listedAfter = await ipcMain.invoke(IPC_CHANNELS.componentList, {});
    expect(listedAfter.components).toEqual([]);
  });


  it('rejects installing an external package over an existing builtin component record', async () => {
    const ipcMain = new IpcMainStub();
    const testDir = mkdtemp('openweave-components-collision-');
    const dbFilePath = path.join(testDir, 'registry.sqlite');
    const installRoot = path.join(testDir, 'installed-components');
    const repository = createRegistryRepository({ dbFilePath });
    const registry = createComponentRegistry({ repository, appVersion: '0.1.0' });
    const builtinRoot = createPackageRoot(path.join(testDir, 'builtin-component'), {
      name: 'builtin.note',
      kind: 'builtin',
      displayName: 'Builtin Note'
    });
    const externalSourceRoot = createPackageRoot(path.join(testDir, 'external-source'), {
      name: 'builtin.note',
      kind: 'external',
      displayName: 'Builtin Note Override'
    });
    registry.registerBuiltinManifest({
      packageRoot: builtinRoot,
      manifest: createManifest({ name: 'builtin.note', kind: 'builtin', displayName: 'Builtin Note' })
    });
    repository.close();

    registerComponentsIpcHandlers({
      dbFilePath,
      installRoot,
      ipcMain,
      appVersion: '0.1.0'
    });

    await expect(
      ipcMain.invoke(IPC_CHANNELS.componentInstall, {
        sourceType: 'directory',
        sourcePath: externalSourceRoot
      })
    ).rejects.toThrow('Cannot replace builtin component with installed package: builtin.note@1.0.0');
  });

  it('rejects repeated uninstall once an external component is already fallback-only', async () => {
    const ipcMain = new IpcMainStub();
    const testDir = mkdtemp('openweave-components-repeat-uninstall-');
    const dbFilePath = path.join(testDir, 'registry.sqlite');
    const installRoot = path.join(testDir, 'installed-components');
    const sourceRoot = createPackageRoot(path.join(testDir, 'source-component'));

    registerComponentsIpcHandlers({
      dbFilePath,
      installRoot,
      ipcMain,
      appVersion: '0.1.0'
    });

    await ipcMain.invoke(IPC_CHANNELS.componentInstall, {
      sourceType: 'directory',
      sourcePath: sourceRoot
    });
    await ipcMain.invoke(IPC_CHANNELS.componentUninstall, {
      name: 'external.note',
      version: '1.0.0'
    });

    await expect(
      ipcMain.invoke(IPC_CHANNELS.componentUninstall, {
        name: 'external.note',
        version: '1.0.0'
      })
    ).rejects.toThrow('Component is not currently installed: external.note@1.0.0');
  });

  it('rejects builtin uninstall through the registered handler', async () => {
    const ipcMain = new IpcMainStub();
    const testDir = mkdtemp('openweave-components-builtin-');
    const dbFilePath = path.join(testDir, 'registry.sqlite');
    const installRoot = path.join(testDir, 'installed-components');
    const repository = createRegistryRepository({ dbFilePath });
    const registry = createComponentRegistry({ repository, appVersion: '0.1.0' });
    const builtinRoot = createPackageRoot(path.join(testDir, 'builtin-component'), {
      name: 'builtin.note',
      kind: 'builtin',
      displayName: 'Builtin Note'
    });
    registry.registerBuiltinManifest({
      packageRoot: builtinRoot,
      manifest: createManifest({ name: 'builtin.note', kind: 'builtin', displayName: 'Builtin Note' })
    });
    repository.close();

    registerComponentsIpcHandlers({
      dbFilePath,
      installRoot,
      ipcMain,
      appVersion: '0.1.0'
    });

    await expect(
      ipcMain.invoke(IPC_CHANNELS.componentUninstall, {
        name: 'builtin.note',
        version: '1.0.0'
      })
    ).rejects.toThrow('Builtin components cannot be uninstalled: builtin.note@1.0.0');
  });
});
