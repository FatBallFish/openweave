import path from 'node:path';
import type { IpcMainInvokeEvent } from 'electron';
import { createComponentInstaller, type ComponentInstaller } from '../components/component-installer';
import { createComponentRegistry, type ComponentRegistry, type ComponentRecord } from '../components/component-registry';
import { createRegistryRepository, type ComponentPackageRecord, type RegistryRepository } from '../db/registry';
import {
  IPC_CHANNELS,
  type ComponentInstallResponse,
  type ComponentListResponse,
  type ComponentSummaryRecord,
  type ComponentUninstallResponse
} from '../../shared/ipc/contracts';
import {
  componentInstallSchema,
  componentListSchema,
  componentUninstallSchema,
  type ComponentInstallInput,
  type ComponentListInput,
  type ComponentUninstallInput
} from '../../shared/ipc/schemas';

export interface ComponentsIpcHandlers {
  list: (_event: IpcMainInvokeEvent, input: ComponentListInput) => Promise<ComponentListResponse>;
  install: (_event: IpcMainInvokeEvent, input: ComponentInstallInput) => Promise<ComponentInstallResponse>;
  uninstall: (
    _event: IpcMainInvokeEvent,
    input: ComponentUninstallInput
  ) => Promise<ComponentUninstallResponse>;
}

export interface ComponentsIpcDependencies {
  componentRegistry: ComponentRegistry;
  componentInstaller: ComponentInstaller;
  listComponentPackages: () => ComponentPackageRecord[];
}

interface ComponentsIpcMain {
  handle: (channel: string, listener: (...args: any[]) => unknown) => void;
  removeHandler: (channel: string) => void;
}

interface ResolvedComponentTarget {
  name: string;
  version: string;
  sourceKind: ComponentPackageRecord['sourceKind'];
}

const toNotInstalledError = (name: string, version: string): Error => {
  return new Error(`Component is not currently installed: ${name}@${version}`);
};

const toSummaryRecord = (record: ComponentRecord): ComponentSummaryRecord => ({
  name: record.name,
  version: record.version,
  kind: record.manifest.kind,
  displayName: record.manifest.displayName,
  category: record.manifest.category,
  capabilities: record.manifest.capabilities,
  installed: record.isInstalled,
  builtin: record.sourceKind === 'builtin'
});

const resolveUninstallTarget = (
  input: ComponentUninstallInput,
  deps: ComponentsIpcDependencies
): ResolvedComponentTarget => {
  const parsed = componentUninstallSchema.parse(input);

  if (parsed.version) {
    const existing = deps.componentRegistry.getExactComponent(parsed.name, parsed.version);
    if (!existing) {
      throw new Error(`Component not found: ${parsed.name}@${parsed.version}`);
    }
    if (existing.sourceKind === 'builtin') {
      return {
        name: existing.name,
        version: existing.version,
        sourceKind: existing.sourceKind
      };
    }
    if (!existing.isEnabled || !existing.isInstalled) {
      throw toNotInstalledError(existing.name, existing.version);
    }
    return {
      name: existing.name,
      version: existing.version,
      sourceKind: existing.sourceKind
    };
  }

  const matches = deps.listComponentPackages().filter((record) => record.name === parsed.name);
  if (matches.length === 0) {
    throw new Error(`Component not found: ${parsed.name}`);
  }
  if (matches.length > 1) {
    throw new Error(`Component version is required because multiple component records match: ${parsed.name}`);
  }
  if (matches.length === 1) {
    if (matches[0].sourceKind === 'builtin') {
      return {
        name: matches[0].name,
        version: matches[0].version,
        sourceKind: matches[0].sourceKind
      };
    }
    if (matches[0].isEnabled && matches[0].isInstalled) {
      return {
        name: matches[0].name,
        version: matches[0].version,
        sourceKind: matches[0].sourceKind
      };
    }
    throw toNotInstalledError(matches[0].name, matches[0].version);
  }

  throw new Error(`Component not found: ${parsed.name}`);
};

export const createComponentsIpcHandlers = (
  deps: ComponentsIpcDependencies
): ComponentsIpcHandlers => {
  return {
    list: async (_event, input) => {
      componentListSchema.parse(input);
      return {
        components: deps.componentRegistry.listEnabledComponents().map(toSummaryRecord)
      };
    },
    install: async (_event, input) => {
      const parsed = componentInstallSchema.parse(input);
      const installed =
        parsed.sourceType === 'directory'
          ? await deps.componentInstaller.installFromDirectory({ packageRoot: parsed.sourcePath })
          : await deps.componentInstaller.installFromZip({ archivePath: parsed.sourcePath });

      return {
        component: {
          componentId: installed.id,
          name: installed.name,
          version: installed.version,
          sourceType: parsed.sourceType,
          installRoot: installed.packageRoot
        }
      };
    },
    uninstall: async (_event, input) => {
      const target = resolveUninstallTarget(input, deps);

      if (target.sourceKind === 'builtin') {
        throw new Error(`Builtin components cannot be uninstalled: ${target.name}@${target.version}`);
      }

      deps.componentInstaller.uninstallExternalComponent(target.name, target.version);

      return {
        name: target.name,
        version: target.version,
        uninstalled: true,
        fallbackRequired:
          deps.componentRegistry.resolveExactVersion(target.name, target.version, 'fallback-only') !==
          null
      };
    }
  };
};

interface RegisteredComponentsIpcContext {
  dbFilePath: string;
  installRoot: string;
  tempRoot: string | null;
  appVersion?: string;
  registryRepository: RegistryRepository;
  componentRegistry: ComponentRegistry;
  componentInstaller: ComponentInstaller;
}

let registeredComponentsIpcContext: RegisteredComponentsIpcContext | null = null;

const resetComponentsContext = (options: {
  dbFilePath: string;
  installRoot: string;
  tempRoot?: string;
  appVersion?: string;
}): RegisteredComponentsIpcContext => {
  const dbFilePath = path.resolve(options.dbFilePath);
  const installRoot = path.resolve(options.installRoot);
  const tempRoot = options.tempRoot ? path.resolve(options.tempRoot) : null;
  const shouldReset =
    registeredComponentsIpcContext &&
    (registeredComponentsIpcContext.dbFilePath !== dbFilePath ||
      registeredComponentsIpcContext.installRoot !== installRoot ||
      registeredComponentsIpcContext.tempRoot !== tempRoot ||
      registeredComponentsIpcContext.appVersion !== options.appVersion);

  if (shouldReset && registeredComponentsIpcContext) {
    registeredComponentsIpcContext.registryRepository.close();
    registeredComponentsIpcContext = null;
  }

  if (!registeredComponentsIpcContext) {
    const registryRepository = createRegistryRepository({ dbFilePath });
    const componentRegistry = createComponentRegistry({
      repository: registryRepository,
      appVersion: options.appVersion
    });
    const componentInstaller = createComponentInstaller({
      componentRegistry,
      installRoot,
      tempRoot: options.tempRoot,
      appVersion: options.appVersion
    });

    registeredComponentsIpcContext = {
      dbFilePath,
      installRoot,
      tempRoot,
      appVersion: options.appVersion,
      registryRepository,
      componentRegistry,
      componentInstaller
    };
  }

  return registeredComponentsIpcContext;
};

const resolveIpcMain = (): ComponentsIpcMain => {
  const { ipcMain } = require('electron') as typeof import('electron');
  return ipcMain;
};

export interface RegisterComponentsIpcHandlersOptions {
  dbFilePath: string;
  installRoot: string;
  tempRoot?: string;
  appVersion?: string;
  ipcMain?: ComponentsIpcMain;
}

export const registerComponentsIpcHandlers = (
  options: RegisterComponentsIpcHandlersOptions
): void => {
  const ipcMain = options.ipcMain ?? resolveIpcMain();
  const context = resetComponentsContext(options);
  const handlers = createComponentsIpcHandlers({
    componentRegistry: context.componentRegistry,
    componentInstaller: context.componentInstaller,
    listComponentPackages: () => context.registryRepository.listComponentPackages()
  });

  ipcMain.removeHandler(IPC_CHANNELS.componentList);
  ipcMain.removeHandler(IPC_CHANNELS.componentInstall);
  ipcMain.removeHandler(IPC_CHANNELS.componentUninstall);

  ipcMain.handle(IPC_CHANNELS.componentList, handlers.list);
  ipcMain.handle(IPC_CHANNELS.componentInstall, handlers.install);
  ipcMain.handle(IPC_CHANNELS.componentUninstall, handlers.uninstall);
};

export const disposeComponentsIpcHandlers = (): void => {
  if (!registeredComponentsIpcContext) {
    return;
  }

  registeredComponentsIpcContext.registryRepository.close();
  registeredComponentsIpcContext = null;
};
