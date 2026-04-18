import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createComponentInstaller } from '../../../src/main/components/component-installer';
import { createComponentRegistry } from '../../../src/main/components/component-registry';
import { createRegistryRepository, type RegistryRepository } from '../../../src/main/db/registry';

type ArchiverFactory = (format: string, options?: { zlib?: { level?: number } }) => {
  directory: (dirpath: string, destpath: string | false) => void;
  finalize: () => Promise<void>;
  on: (event: 'error', listener: (error: Error) => void) => void;
  pipe: (stream: NodeJS.WritableStream) => NodeJS.WritableStream;
};
const archiver = require('archiver') as ArchiverFactory;
const demoEchoFixtureRoot = path.resolve(process.cwd(), 'tests/fixtures/components/demo-echo');

const loadModuleExportsWithNode = (modulePath: string): Record<string, unknown> => {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        '-e',
        "const mod=require(process.argv[1]);process.stdout.write(JSON.stringify(mod));",
        modulePath
      ],
      {
        encoding: 'utf8'
      }
    )
  ) as Record<string, unknown>;
};

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
let registryRepository: RegistryRepository;

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-component-installer-'));
  registryRepository = createRegistryRepository({
    dbFilePath: path.join(testDir, 'registry.sqlite'),
    now: () => 1_700_000_000_000
  });
});

afterEach(() => {
  registryRepository.close();
  if (testDir !== '') {
    fs.rmSync(testDir, { recursive: true, force: true });
    testDir = '';
  }
});

describe('component installer', () => {
  const createZipArchive = async (sourceRoot: string, zipPath: string): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', {
        zlib: {
          level: 9
        }
      });

      output.on('close', () => resolve());
      output.on('error', reject);
      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(sourceRoot, false);
      void archive.finalize();
    });
  };

  const createPackageRoot = (dirName: string, overrides: Record<string, unknown> = {}): string => {
    const packageRoot = path.join(testDir, dirName);
    fs.mkdirSync(path.join(packageRoot, 'renderer'), { recursive: true });
    fs.mkdirSync(path.join(packageRoot, 'worker'), { recursive: true });
    fs.writeFileSync(path.join(packageRoot, 'renderer', 'index.js'), 'export const renderer = true;\n');
    fs.writeFileSync(path.join(packageRoot, 'worker', 'index.js'), 'export const worker = true;\n');
    fs.writeFileSync(
      path.join(packageRoot, 'component.json'),
      JSON.stringify(createManifest(overrides), null, 2)
    );
    return packageRoot;
  };

  const createInstallerContext = () => {
    const componentRegistry = createComponentRegistry({
      repository: registryRepository,
      appVersion: '0.1.0'
    });

    return {
      componentRegistry,
      installer: createComponentInstaller({
        componentRegistry,
        installRoot: path.join(testDir, 'installed-components')
      })
    };
  };

  const createInstaller = () => createInstallerContext().installer;

  it('installs an external component from a local directory into the managed install root', async () => {
    const sourceRoot = createPackageRoot('source-package');
    const installer = createInstaller();

    const installed = await installer.installFromDirectory({
      packageRoot: sourceRoot
    });
    const expectedInstallRoot = fs.realpathSync(
      path.join(testDir, 'installed-components', 'external.note', '1.0.0')
    );

    expect(installed.id).toBe('external.note@1.0.0');
    expect(installed.packageRoot).toBe(expectedInstallRoot);
    expect(fs.existsSync(path.join(installed.packageRoot, 'component.json'))).toBe(true);
    expect(fs.readFileSync(path.join(installed.packageRoot, 'renderer', 'index.js'), 'utf8')).toContain(
      'renderer = true'
    );

    const persisted = registryRepository.getComponentPackage('external.note', '1.0.0');
    expect(persisted?.packageRoot).toBe(installed.packageRoot);
    expect(persisted?.packageChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(persisted?.isInstalled).toBe(true);
  });

  it('installs from a zip archive after unpacking to a temporary directory', async () => {
    const sourceRoot = createPackageRoot('zip-source', {
      name: 'external.whiteboard',
      version: '2.0.0',
      displayName: 'Whiteboard'
    });
    const zipPath = path.join(testDir, 'component.zip');
    await createZipArchive(sourceRoot, zipPath);
    const installer = createInstaller();

    const installed = await installer.installFromZip({
      archivePath: zipPath
    });
    const expectedInstallRoot = fs.realpathSync(
      path.join(testDir, 'installed-components', 'external.whiteboard', '2.0.0')
    );

    expect(installed.id).toBe('external.whiteboard@2.0.0');
    expect(installed.packageRoot).toBe(expectedInstallRoot);
    expect(fs.existsSync(path.join(installed.packageRoot, 'worker', 'index.js'))).toBe(true);
  });

  it('installs the demo echo fixture from a local directory and exposes it in the enabled component list', async () => {
    const { componentRegistry, installer } = createInstallerContext();

    const installed = await installer.installFromDirectory({
      packageRoot: demoEchoFixtureRoot
    });

    expect(installed.id).toBe('external.demo-echo@0.1.0');
    expect(componentRegistry.listEnabledComponents().map((record) => record.id)).toContain(
      'external.demo-echo@0.1.0'
    );
    expect(componentRegistry.getExactComponent('external.demo-echo', '0.1.0')?.manifest.displayName).toBe(
      'Demo Echo'
    );
    expect(
      fs.existsSync(path.join(installed.packageRoot, 'schemas', 'action.echo.output.json'))
    ).toBe(true);
    expect(
      loadModuleExportsWithNode(path.join(installed.packageRoot, 'renderer', 'index.js'))
    ).toEqual({
      renderer: {
        kind: 'demo-echo-renderer'
      }
    });
  });

  it('installs the demo echo fixture from a zip archive and preserves manifest metadata', async () => {
    const { componentRegistry, installer } = createInstallerContext();
    const zipPath = path.join(testDir, 'demo-echo.zip');
    await createZipArchive(demoEchoFixtureRoot, zipPath);

    const installed = await installer.installFromZip({
      archivePath: zipPath
    });
    const resolved = componentRegistry.resolveExactVersion(installed.name, installed.version, 'enabled');

    expect(installed.id).toBe('external.demo-echo@0.1.0');
    expect(resolved?.manifest.actions.map((action) => action.name)).toEqual(['read', 'write', 'echo']);
    expect(resolved?.manifest.capabilities).toEqual(['read', 'write']);
    expect(
      fs.existsSync(path.join(installed.packageRoot, 'schemas', 'action.write.input.json'))
    ).toBe(true);
  });

  it('returns the existing installed record when the same package contents are installed twice', async () => {
    const sourceRoot = createPackageRoot('dedupe-source');
    const installer = createInstaller();

    const first = await installer.installFromDirectory({ packageRoot: sourceRoot });
    fs.writeFileSync(path.join(first.packageRoot, 'sentinel.txt'), 'keep me\n');

    const second = await installer.installFromDirectory({ packageRoot: sourceRoot });

    expect(second).toEqual(first);
    expect(fs.readFileSync(path.join(first.packageRoot, 'sentinel.txt'), 'utf8')).toBe('keep me\n');
    expect(registryRepository.listComponentPackages()).toHaveLength(1);
  });


  it('rejects installing an external package over an existing builtin component record', async () => {
    const builtinRoot = createPackageRoot('builtin-source', {
      name: 'builtin.note',
      kind: 'builtin',
      displayName: 'Builtin Note'
    });
    const externalOverrideRoot = createPackageRoot('builtin-override-source', {
      name: 'builtin.note',
      kind: 'external',
      displayName: 'Builtin Override'
    });
    const componentRegistry = createComponentRegistry({
      repository: registryRepository,
      appVersion: '0.1.0'
    });
    componentRegistry.registerBuiltinManifest({
      packageRoot: builtinRoot,
      manifest: createManifest({ name: 'builtin.note', kind: 'builtin', displayName: 'Builtin Note' })
    });
    const installer = createComponentInstaller({
      componentRegistry,
      installRoot: path.join(testDir, 'installed-components')
    });

    await expect(
      installer.installFromDirectory({ packageRoot: externalOverrideRoot })
    ).rejects.toThrow('Cannot replace builtin component with installed package: builtin.note@1.0.0');

    const persisted = registryRepository.getComponentPackage('builtin.note', '1.0.0');
    expect(persisted?.sourceKind).toBe('builtin');
    expect(persisted?.manifest.displayName).toBe('Builtin Note');
  });

  it('uninstalls an external component through registry semantics without deleting installed files', async () => {
    const sourceRoot = createPackageRoot('uninstall-source');
    const installer = createInstaller();
    const installed = await installer.installFromDirectory({ packageRoot: sourceRoot });

    installer.uninstallExternalComponent('external.note', '1.0.0');

    const fallback = registryRepository.getComponentPackage('external.note', '1.0.0');
    expect(fallback?.isEnabled).toBe(false);
    expect(fallback?.isInstalled).toBe(false);
    expect(fs.existsSync(installed.packageRoot)).toBe(true);
  });

  it('reinstalls the same package after uninstall and restores it to enabled installed state', async () => {
    const sourceRoot = createPackageRoot('reinstall-source');
    const installer = createInstaller();

    await installer.installFromDirectory({ packageRoot: sourceRoot });
    installer.uninstallExternalComponent('external.note', '1.0.0');

    const reinstalled = await installer.installFromDirectory({ packageRoot: sourceRoot });
    const persisted = registryRepository.getComponentPackage('external.note', '1.0.0');

    expect(reinstalled.isEnabled).toBe(true);
    expect(reinstalled.isInstalled).toBe(true);
    expect(persisted?.isEnabled).toBe(true);
    expect(persisted?.isInstalled).toBe(true);
  });

  it('restores previous registry metadata when filesystem cleanup fails after registry persistence', async () => {
    const firstSourceRoot = createPackageRoot('rollback-source-a', {
      displayName: 'Original Note'
    });
    const secondSourceRoot = createPackageRoot('rollback-source-b', {
      displayName: 'Updated Note'
    });
    const installer = createInstaller();

    const original = await installer.installFromDirectory({ packageRoot: firstSourceRoot });
    const originalChecksum = registryRepository.getComponentPackage('external.note', '1.0.0')?.packageChecksum;
    const originalRmSync = fs.rmSync;
    const rmSyncSpy = vi.spyOn(fs, 'rmSync');
    rmSyncSpy.mockImplementation((targetPath, options) => {
      if (typeof targetPath === 'string' && targetPath.includes('.backup-')) {
        throw new Error('cleanup failed');
      }
      return originalRmSync(targetPath, options);
    });

    await expect(
      installer.installFromDirectory({
        packageRoot: secondSourceRoot
      })
    ).rejects.toThrow('cleanup failed');

    rmSyncSpy.mockRestore();

    const persisted = registryRepository.getComponentPackage('external.note', '1.0.0');
    expect(persisted?.manifest.displayName).toBe('Original Note');
    expect(persisted?.packageChecksum).toBe(originalChecksum);
    expect(persisted?.isEnabled).toBe(true);
    expect(persisted?.isInstalled).toBe(true);
    expect(fs.readFileSync(path.join(original.packageRoot, 'component.json'), 'utf8')).toContain(
      'Original Note'
    );
  });

  it('restores fallback-only status when a reinstall fails after registry persistence', async () => {
    const firstSourceRoot = createPackageRoot('rollback-fallback-a', {
      displayName: 'Fallback Note'
    });
    const secondSourceRoot = createPackageRoot('rollback-fallback-b', {
      displayName: 'Replacement Note'
    });
    const installer = createInstaller();

    const original = await installer.installFromDirectory({ packageRoot: firstSourceRoot });
    installer.uninstallExternalComponent('external.note', '1.0.0');

    const originalChecksum = registryRepository.getComponentPackage('external.note', '1.0.0')?.packageChecksum;
    const originalRmSync = fs.rmSync;
    const rmSyncSpy = vi.spyOn(fs, 'rmSync');
    rmSyncSpy.mockImplementation((targetPath, options) => {
      if (typeof targetPath === 'string' && targetPath.includes('.backup-')) {
        throw new Error('cleanup failed');
      }
      return originalRmSync(targetPath, options);
    });

    await expect(
      installer.installFromDirectory({
        packageRoot: secondSourceRoot
      })
    ).rejects.toThrow('cleanup failed');

    rmSyncSpy.mockRestore();

    const persisted = registryRepository.getComponentPackage('external.note', '1.0.0');
    expect(persisted?.manifest.displayName).toBe('Fallback Note');
    expect(persisted?.packageChecksum).toBe(originalChecksum);
    expect(persisted?.isEnabled).toBe(false);
    expect(persisted?.isInstalled).toBe(false);
    expect(fs.readFileSync(path.join(original.packageRoot, 'component.json'), 'utf8')).toContain(
      'Fallback Note'
    );
  });
});
