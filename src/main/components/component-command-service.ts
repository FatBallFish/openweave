import { createComponentInstaller } from './component-installer';
import { createComponentRegistry } from './component-registry';
import { createRegistryRepository } from '../db/registry';
import { createComponentsIpcHandlers } from '../ipc/components';
import type {
  ComponentInstallResponse,
  ComponentListResponse,
  ComponentUninstallResponse
} from '../../shared/ipc/contracts';

export interface LocalComponentCommandService {
  list: () => Promise<ComponentListResponse>;
  installFromDirectory: (sourcePath: string) => Promise<ComponentInstallResponse>;
  installFromZip: (sourcePath: string) => Promise<ComponentInstallResponse>;
  uninstall: (name: string, version?: string) => Promise<ComponentUninstallResponse>;
}

export interface CreateLocalComponentCommandServiceOptions {
  dbFilePath: string;
  installRoot: string;
  tempRoot?: string;
  appVersion: string;
}

const withComponentsHandler = async <T>(
  options: CreateLocalComponentCommandServiceOptions,
  run: (service: ReturnType<typeof createComponentsIpcHandlers>) => Promise<T>
): Promise<T> => {
  const registryRepository = createRegistryRepository({ dbFilePath: options.dbFilePath });

  try {
    const componentRegistry = createComponentRegistry({
      repository: registryRepository,
      appVersion: options.appVersion
    });
    const componentInstaller = createComponentInstaller({
      componentRegistry,
      installRoot: options.installRoot,
      tempRoot: options.tempRoot,
      appVersion: options.appVersion
    });
    const handlers = createComponentsIpcHandlers({
      componentRegistry,
      componentInstaller,
      listComponentPackages: () => registryRepository.listComponentPackages()
    });

    return await run(handlers);
  } finally {
    registryRepository.close();
  }
};

export const createLocalComponentCommandService = (
  options: CreateLocalComponentCommandServiceOptions
): LocalComponentCommandService => {
  return {
    list: async () => withComponentsHandler(options, (handlers) => handlers.list({} as never, {})),
    installFromDirectory: async (sourcePath) =>
      withComponentsHandler(options, (handlers) =>
        handlers.install({} as never, {
          sourceType: 'directory',
          sourcePath
        })
      ),
    installFromZip: async (sourcePath) =>
      withComponentsHandler(options, (handlers) =>
        handlers.install({} as never, {
          sourceType: 'zip',
          sourcePath
        })
      ),
    uninstall: async (name, version) =>
      withComponentsHandler(options, (handlers) => handlers.uninstall({} as never, { name, version }))
  };
};
