import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ComponentRecord, ComponentRegistry } from '../../../src/main/components/component-registry';
import { createComponentInstaller, findComponentPackageRoot } from '../../../src/main/components/component-installer';

const createManifest = (overrides: Record<string, unknown> = {}) => ({
  manifestVersion: 1,
  name: 'external.note',
  version: '1.0.0',
  displayName: 'External Note',
  category: 'knowledge',
  kind: 'external',
  description: 'Editable note component',
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

let testDir = '';

afterEach(() => {
  if (testDir !== '') {
    fs.rmSync(testDir, { recursive: true, force: true });
    testDir = '';
  }
});

describe('component installer rollback', () => {
  const createPackageRoot = (): string => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-component-installer-unit-'));
    const packageRoot = path.join(testDir, 'source-package');
    fs.mkdirSync(path.join(packageRoot, 'renderer'), { recursive: true });
    fs.mkdirSync(path.join(packageRoot, 'worker'), { recursive: true });
    fs.writeFileSync(path.join(packageRoot, 'renderer', 'index.js'), 'export {}\n');
    fs.writeFileSync(path.join(packageRoot, 'worker', 'index.js'), 'export {}\n');
    fs.writeFileSync(path.join(packageRoot, 'component.json'), JSON.stringify(createManifest(), null, 2));
    return packageRoot;
  };

  it('removes a copied install directory when registry persistence fails', async () => {
    const sourceRoot = createPackageRoot();
    const installRoot = path.join(testDir, 'install-root');
    const registerInstalledManifest = (): ComponentRecord => {
      throw new Error('database unavailable');
    };
    const componentRegistry: ComponentRegistry = {
      registerBuiltinManifest: () => {
        throw new Error('not used');
      },
      registerInstalledManifest,
      listEnabledComponents: () => [],
      getExactComponent: () => null,
      disableBuiltinComponent: () => {
        throw new Error('not used');
      },
      uninstallExternalComponent: () => {
        throw new Error('not used');
      },
      resolveExactVersion: () => null
    };
    const installer = createComponentInstaller({ componentRegistry, installRoot });

    await expect(
      installer.installFromDirectory({
        packageRoot: sourceRoot
      })
    ).rejects.toThrow('database unavailable');
    expect(fs.existsSync(path.join(installRoot, 'external.note', '1.0.0'))).toBe(false);
  });

  it('finds a package root without following symlinked directories outside the search root', () => {
    const sourceRoot = createPackageRoot();
    const outsideRoot = path.join(testDir, 'outside-package');
    fs.mkdirSync(path.join(outsideRoot, 'renderer'), { recursive: true });
    fs.mkdirSync(path.join(outsideRoot, 'worker'), { recursive: true });
    fs.writeFileSync(path.join(outsideRoot, 'renderer', 'index.js'), 'export {}\n');
    fs.writeFileSync(path.join(outsideRoot, 'worker', 'index.js'), 'export {}\n');
    fs.writeFileSync(path.join(outsideRoot, 'component.json'), JSON.stringify(createManifest(), null, 2));
    fs.symlinkSync(outsideRoot, path.join(sourceRoot, 'linked-outside'));

    expect(findComponentPackageRoot(sourceRoot)).toBe(fs.realpathSync(sourceRoot));
  });

  it('finds a package root without recursing through symlink loops', () => {
    const sourceRoot = createPackageRoot();
    fs.symlinkSync(sourceRoot, path.join(sourceRoot, 'loop'));

    expect(findComponentPackageRoot(testDir)).toBe(fs.realpathSync(sourceRoot));
  });
});
