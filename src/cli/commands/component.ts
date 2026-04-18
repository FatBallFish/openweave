import fs from 'node:fs';
import path from 'node:path';
import {
  createLocalComponentCommandService,
  type LocalComponentCommandService
} from '../../main/components/component-command-service';
import type {
  ComponentInstallResponse,
  ComponentListResponse,
  ComponentUninstallResponse
} from '../../shared/ipc/contracts';

export interface CliComponentService {
  list: () => Promise<ComponentListResponse>;
  installFromDirectory: (sourcePath: string) => Promise<ComponentInstallResponse>;
  installFromZip: (sourcePath: string) => Promise<ComponentInstallResponse>;
  uninstall: (name: string, version?: string) => Promise<ComponentUninstallResponse>;
}

export interface CliComponentServiceOptions {
  env?: NodeJS.ProcessEnv;
}

interface ComponentRuntimeOptions {
  dbFilePath: string;
  installRoot: string;
  appVersion: string;
}

let cachedDefaultCliAppVersion: string | null = null;

export const resolveDefaultCliAppVersion = (): string => {
  if (cachedDefaultCliAppVersion) {
    return cachedDefaultCliAppVersion;
  }

  const packageJsonPath = path.resolve(__dirname, '../../../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    version?: string;
  };
  if (!packageJson.version) {
    throw new Error(`App version not found in ${packageJsonPath}`);
  }

  cachedDefaultCliAppVersion = packageJson.version;
  return cachedDefaultCliAppVersion;
};

const resolveRuntimeOptions = (env: NodeJS.ProcessEnv): ComponentRuntimeOptions => ({
  dbFilePath: path.resolve(env.OPENWEAVE_REGISTRY_DB_PATH ?? path.join(process.cwd(), '.openweave', 'registry.sqlite')),
  installRoot: path.resolve(
    env.OPENWEAVE_COMPONENT_INSTALL_ROOT ?? path.join(process.cwd(), '.openweave', 'components')
  ),
  appVersion: env.OPENWEAVE_APP_VERSION ?? resolveDefaultCliAppVersion()
});

export const createCliComponentService = (
  options: CliComponentServiceOptions = {}
): CliComponentService => {
  const runtimeOptions = resolveRuntimeOptions(options.env ?? process.env);
  const service: LocalComponentCommandService = createLocalComponentCommandService(runtimeOptions);

  return {
    list: async () => service.list(),
    installFromDirectory: async (sourcePath) => service.installFromDirectory(sourcePath),
    installFromZip: async (sourcePath) => service.installFromZip(sourcePath),
    uninstall: async (name, version) => service.uninstall(name, version)
  };
};

const formatCapabilities = (capabilities: string[]): string => capabilities.join(',');

export const formatComponentListText = (response: ComponentListResponse): string => {
  if (response.components.length === 0) {
    return 'No enabled components.\n';
  }

  return response.components
    .map(
      (component) =>
        `${component.name}@${component.version} ${component.displayName} [${component.kind}/${component.category}] caps=${formatCapabilities(component.capabilities)}`
    )
    .join('\n')
    .concat('\n');
};

export const formatComponentInstallText = (response: ComponentInstallResponse): string => {
  return `Installed ${response.component.componentId} from ${response.component.sourceType} -> ${response.component.installRoot}\n`;
};

export const formatComponentUninstallText = (response: ComponentUninstallResponse): string => {
  const versionSuffix = response.version ? `@${response.version}` : '';
  const fallbackSuffix = response.fallbackRequired ? ' fallback=true' : '';
  return `Uninstalled ${response.name}${versionSuffix}${fallbackSuffix}\n`;
};
