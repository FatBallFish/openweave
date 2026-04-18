import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { createComponentsIpcHandlers } from '../../../src/main/ipc/components';
import type { ComponentInstaller } from '../../../src/main/components/component-installer';
import type { ComponentRecord, ComponentRegistry } from '../../../src/main/components/component-registry';
import type { ComponentPackageRecord } from '../../../src/main/db/registry';

const createComponentRecord = (overrides: Partial<ComponentRecord> = {}): ComponentRecord => ({
  id: 'external.note@1.0.0',
  name: 'external.note',
  version: '1.0.0',
  sourceKind: 'external',
  packageRoot: '/components/external.note/1.0.0',
  packageChecksum: 'checksum-1',
  manifest: {
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
    }
  },
  isEnabled: true,
  isInstalled: true,
  createdAtMs: 1,
  updatedAtMs: 1,
  ...overrides
});

const createPackageRecord = (overrides: Partial<ComponentPackageRecord> = {}): ComponentPackageRecord => {
  const component = createComponentRecord();
  return {
    name: component.name,
    version: component.version,
    sourceKind: component.sourceKind,
    packageRoot: component.packageRoot,
    packageChecksum: component.packageChecksum,
    manifest: component.manifest,
    isEnabled: component.isEnabled,
    isInstalled: component.isInstalled,
    createdAtMs: component.createdAtMs,
    updatedAtMs: component.updatedAtMs,
    ...overrides
  };
};

describe('components IPC handlers', () => {
  it('dispatches installs by source type and maps the installed component response', async () => {
    const installed = createComponentRecord();
    const installFromDirectory = vi.fn(async () => installed);
    const installFromZip = vi.fn(async () => installed);
    const handlers = createComponentsIpcHandlers({
      componentRegistry: {
        listEnabledComponents: vi.fn(() => []),
        getExactComponent: vi.fn(() => installed),
        registerBuiltinManifest: vi.fn(),
        registerInstalledManifest: vi.fn(),
        disableBuiltinComponent: vi.fn(),
        uninstallExternalComponent: vi.fn(),
        resolveExactVersion: vi.fn(() => installed)
      } satisfies ComponentRegistry,
      componentInstaller: {
        installFromDirectory,
        installFromZip,
        uninstallExternalComponent: vi.fn()
      } satisfies ComponentInstaller,
      listComponentPackages: vi.fn(() => [createPackageRecord()])
    });

    const directoryResult = await handlers.install({} as IpcMainInvokeEvent, {
      sourceType: 'directory',
      sourcePath: '/tmp/component-dir'
    });
    const zipResult = await handlers.install({} as IpcMainInvokeEvent, {
      sourceType: 'zip',
      sourcePath: '/tmp/component.zip'
    });

    expect(installFromDirectory).toHaveBeenCalledWith({ packageRoot: '/tmp/component-dir' });
    expect(installFromZip).toHaveBeenCalledWith({ archivePath: '/tmp/component.zip' });
    expect(directoryResult.component).toMatchObject({
      componentId: 'external.note@1.0.0',
      sourceType: 'directory',
      installRoot: '/components/external.note/1.0.0'
    });
    expect(zipResult.component).toMatchObject({
      componentId: 'external.note@1.0.0',
      sourceType: 'zip',
      installRoot: '/components/external.note/1.0.0'
    });
  });


  it('rejects uninstall when the matching external record is fallback-only or already uninstalled', async () => {
    const fallbackOnly = createComponentRecord({
      isEnabled: false,
      isInstalled: false
    });
    const uninstallExternalComponent = vi.fn();
    const handlers = createComponentsIpcHandlers({
      componentRegistry: {
        listEnabledComponents: vi.fn(() => []),
        getExactComponent: vi.fn((name: string, version: string) =>
          name === fallbackOnly.name && version === fallbackOnly.version ? fallbackOnly : null
        ),
        registerBuiltinManifest: vi.fn(),
        registerInstalledManifest: vi.fn(),
        disableBuiltinComponent: vi.fn(),
        uninstallExternalComponent: vi.fn(),
        resolveExactVersion: vi.fn(() => fallbackOnly)
      } satisfies ComponentRegistry,
      componentInstaller: {
        installFromDirectory: vi.fn(),
        installFromZip: vi.fn(),
        uninstallExternalComponent
      } satisfies ComponentInstaller,
      listComponentPackages: vi.fn(() => [
        createPackageRecord({
          name: fallbackOnly.name,
          version: fallbackOnly.version,
          isEnabled: false,
          isInstalled: false
        })
      ])
    });

    await expect(
      handlers.uninstall({} as IpcMainInvokeEvent, { name: fallbackOnly.name, version: fallbackOnly.version })
    ).rejects.toThrow(`Component is not currently installed: ${fallbackOnly.name}@${fallbackOnly.version}`);

    await expect(
      handlers.uninstall({} as IpcMainInvokeEvent, { name: fallbackOnly.name })
    ).rejects.toThrow(`Component is not currently installed: ${fallbackOnly.name}@${fallbackOnly.version}`);

    expect(uninstallExternalComponent).not.toHaveBeenCalled();
  });


  it('treats name-only uninstall as ambiguous when multiple records share a name even if only one is enabled', async () => {
    const enabled = createComponentRecord({
      name: 'external.note',
      version: '2.0.0',
      id: 'external.note@2.0.0',
      isEnabled: true,
      isInstalled: true
    });
    const fallbackOnly = createComponentRecord({
      name: 'external.note',
      version: '1.0.0',
      id: 'external.note@1.0.0',
      isEnabled: false,
      isInstalled: false
    });
    const uninstallExternalComponent = vi.fn();
    const handlers = createComponentsIpcHandlers({
      componentRegistry: {
        listEnabledComponents: vi.fn(() => [enabled]),
        getExactComponent: vi.fn((name: string, version: string) => {
          if (name === enabled.name && version === enabled.version) {
            return enabled;
          }
          if (name === fallbackOnly.name && version === fallbackOnly.version) {
            return fallbackOnly;
          }
          return null;
        }),
        registerBuiltinManifest: vi.fn(),
        registerInstalledManifest: vi.fn(),
        disableBuiltinComponent: vi.fn(),
        uninstallExternalComponent: vi.fn(),
        resolveExactVersion: vi.fn(() => fallbackOnly)
      } satisfies ComponentRegistry,
      componentInstaller: {
        installFromDirectory: vi.fn(),
        installFromZip: vi.fn(),
        uninstallExternalComponent
      } satisfies ComponentInstaller,
      listComponentPackages: vi.fn(() => [
        createPackageRecord({ name: enabled.name, version: enabled.version, isEnabled: true, isInstalled: true }),
        createPackageRecord({ name: fallbackOnly.name, version: fallbackOnly.version, isEnabled: false, isInstalled: false })
      ])
    });

    await expect(
      handlers.uninstall({} as IpcMainInvokeEvent, { name: 'external.note' })
    ).rejects.toThrow('Component version is required because multiple component records match: external.note');

    expect(uninstallExternalComponent).not.toHaveBeenCalled();
  });

  it('rejects builtin uninstalls and ambiguous name-only uninstalls with clear errors', async () => {
    const builtin = createComponentRecord({
      id: 'builtin.note@1.0.0',
      name: 'builtin.note',
      sourceKind: 'builtin',
      manifest: {
        ...createComponentRecord().manifest,
        name: 'builtin.note',
        kind: 'builtin',
        displayName: 'Builtin Note'
      }
    });
    const componentRegistry = {
      listEnabledComponents: vi.fn(() => [builtin]),
      getExactComponent: vi.fn((name: string, version: string) =>
        name === builtin.name && version === builtin.version ? builtin : null
      ),
      registerBuiltinManifest: vi.fn(),
      registerInstalledManifest: vi.fn(),
      disableBuiltinComponent: vi.fn(),
      uninstallExternalComponent: vi.fn(),
      resolveExactVersion: vi.fn(() => builtin)
    } satisfies ComponentRegistry;

    const handlers = createComponentsIpcHandlers({
      componentRegistry,
      componentInstaller: {
        installFromDirectory: vi.fn(),
        installFromZip: vi.fn(),
        uninstallExternalComponent: vi.fn()
      } satisfies ComponentInstaller,
      listComponentPackages: vi.fn(() => [
        createPackageRecord({ name: 'external.note', version: '1.0.0' }),
        createPackageRecord({ name: 'external.note', version: '2.0.0' }),
        createPackageRecord({ name: 'builtin.note', version: '1.0.0', sourceKind: 'builtin' })
      ])
    });

    await expect(
      handlers.uninstall({} as IpcMainInvokeEvent, { name: 'builtin.note', version: '1.0.0' })
    ).rejects.toThrow('Builtin components cannot be uninstalled: builtin.note@1.0.0');

    await expect(
      handlers.uninstall({} as IpcMainInvokeEvent, { name: 'external.note' })
    ).rejects.toThrow('Component version is required because multiple component records match: external.note');
  });
});
