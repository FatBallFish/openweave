import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createComponentRegistry } from '../../../src/main/components/component-registry';
import { createRegistryRepository, type RegistryRepository } from '../../../src/main/db/registry';

const createManifest = (overrides: Record<string, unknown> = {}) => ({
  manifestVersion: 1,
  name: 'builtin.note',
  version: '1.0.0',
  displayName: 'Note',
  category: 'knowledge',
  kind: 'builtin',
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
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-component-registry-'));
  registryRepository = createRegistryRepository({
    dbFilePath: path.join(testDir, 'registry.sqlite'),
    now: () => 1_700_000_000_000
  });
});

afterEach(() => {
  registryRepository.close();
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe('component registry', () => {
  const createPackageRoot = (dirName: string): string => {
    const packageRoot = path.join(testDir, dirName);
    fs.mkdirSync(path.join(packageRoot, 'renderer'), { recursive: true });
    fs.mkdirSync(path.join(packageRoot, 'worker'), { recursive: true });
    fs.writeFileSync(path.join(packageRoot, 'renderer', 'index.js'), 'export {}\n');
    fs.writeFileSync(path.join(packageRoot, 'worker', 'index.js'), 'export {}\n');
    return packageRoot;
  };

  it('registers builtin and installed manifests and lists enabled components', () => {
    const service = createComponentRegistry({
      repository: registryRepository,
      appVersion: '0.1.0'
    });

    const builtinRoot = createPackageRoot('builtin-note');
    const externalRoot = createPackageRoot('external-note');

    const builtin = service.registerBuiltinManifest({
      packageRoot: builtinRoot,
      manifest: createManifest()
    });
    const external = service.registerInstalledManifest({
      packageRoot: externalRoot,
      manifest: createManifest({
        name: 'external.note',
        version: '2.0.0',
        kind: 'external',
        displayName: 'External Note'
      })
    });

    expect(builtin.sourceKind).toBe('builtin');
    expect(external.sourceKind).toBe('external');
    expect(service.listEnabledComponents().map((item) => item.id)).toEqual([
      'builtin.note@1.0.0',
      'external.note@2.0.0'
    ]);
    expect(service.getExactComponent('builtin.note', '1.0.0')?.manifest.displayName).toBe('Note');
  });

  it('disables a builtin component while preserving fallback metadata resolution', () => {
    const service = createComponentRegistry({
      repository: registryRepository,
      appVersion: '0.1.0'
    });
    const builtinRoot = createPackageRoot('builtin-note');

    service.registerBuiltinManifest({
      packageRoot: builtinRoot,
      manifest: createManifest()
    });

    service.disableBuiltinComponent('builtin.note', '1.0.0');

    expect(service.listEnabledComponents()).toEqual([]);
    expect(service.resolveExactVersion('builtin.note', '1.0.0', 'enabled')).toBeNull();
    expect(service.resolveExactVersion('builtin.note', '1.0.0', 'fallback-only')?.id).toBe(
      'builtin.note@1.0.0'
    );
  });


  it('rejects registering an installed component over an existing builtin record', () => {
    const service = createComponentRegistry({
      repository: registryRepository,
      appVersion: '0.1.0'
    });
    const builtinRoot = createPackageRoot('builtin-note');
    const externalRoot = createPackageRoot('external-builtin-note');

    service.registerBuiltinManifest({
      packageRoot: builtinRoot,
      manifest: createManifest()
    });

    expect(() =>
      service.registerInstalledManifest({
        packageRoot: externalRoot,
        manifest: createManifest({
          kind: 'external',
          displayName: 'Builtin Override'
        })
      })
    ).toThrow('Cannot replace builtin component with installed package: builtin.note@1.0.0');
  });

  it('uninstalls an external component while preserving fallback metadata resolution', () => {
    const service = createComponentRegistry({
      repository: registryRepository,
      appVersion: '0.1.0'
    });
    const externalRoot = createPackageRoot('external-note');

    service.registerInstalledManifest({
      packageRoot: externalRoot,
      manifest: createManifest({
        name: 'external.note',
        version: '2.0.0',
        kind: 'external',
        displayName: 'External Note'
      })
    });

    service.uninstallExternalComponent('external.note', '2.0.0');

    expect(service.listEnabledComponents()).toEqual([]);
    expect(service.resolveExactVersion('external.note', '2.0.0', 'enabled')).toBeNull();
    expect(service.resolveExactVersion('external.note', '2.0.0', 'fallback-only')?.sourceKind).toBe(
      'external'
    );
  });

  it('re-registers the same name and version as a single package record', () => {
    const service = createComponentRegistry({
      repository: registryRepository,
      appVersion: '0.1.0'
    });
    const packageRoot = createPackageRoot('builtin-note');

    service.registerBuiltinManifest({
      packageRoot,
      manifest: createManifest({ displayName: 'Original Name' })
    });
    service.registerBuiltinManifest({
      packageRoot,
      manifest: createManifest({ displayName: 'Updated Name' })
    });

    expect(service.listEnabledComponents()).toHaveLength(1);
    expect(service.getExactComponent('builtin.note', '1.0.0')?.manifest.displayName).toBe(
      'Updated Name'
    );
  });
});
