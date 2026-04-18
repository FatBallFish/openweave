import type { ComponentManifestV1 } from '../../shared/components/manifest';
import type {
  ComponentPackageRecord,
  RegistryRepository,
  UpsertComponentPackageInput
} from '../db/registry';
import { normalizeComponentManifest } from './manifest-loader';

export type ComponentResolveMode = 'enabled' | 'fallback-only';

export interface ComponentRecord {
  id: string;
  name: string;
  version: string;
  sourceKind: 'builtin' | 'external';
  packageRoot: string;
  packageChecksum: string | null;
  manifest: ComponentManifestV1;
  isEnabled: boolean;
  isInstalled: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface RegisterComponentManifestInput {
  packageRoot: string;
  manifest: ComponentManifestV1;
  packageChecksum?: string | null;
}

export interface ComponentRegistry {
  registerBuiltinManifest: (input: RegisterComponentManifestInput) => ComponentRecord;
  registerInstalledManifest: (input: RegisterComponentManifestInput) => ComponentRecord;
  listEnabledComponents: () => ComponentRecord[];
  getExactComponent: (name: string, version: string) => ComponentRecord | null;
  disableBuiltinComponent: (name: string, version: string) => void;
  uninstallExternalComponent: (name: string, version: string) => void;
  resolveExactVersion: (name: string, version: string, mode: ComponentResolveMode) => ComponentRecord | null;
}

export interface CreateComponentRegistryOptions {
  repository: RegistryRepository;
  appVersion?: string;
}

const toComponentId = (name: string, version: string): string => `${name}@${version}`;

const mapRecord = (record: ComponentPackageRecord): ComponentRecord => ({
  id: toComponentId(record.name, record.version),
  name: record.name,
  version: record.version,
  sourceKind: record.sourceKind,
  packageRoot: record.packageRoot,
  packageChecksum: record.packageChecksum,
  manifest: record.manifest,
  isEnabled: record.isEnabled,
  isInstalled: record.isInstalled,
  createdAtMs: record.createdAtMs,
  updatedAtMs: record.updatedAtMs
});

const prepareUpsertInput = (
  input: RegisterComponentManifestInput,
  sourceKind: 'builtin' | 'external',
  appVersion?: string
): UpsertComponentPackageInput => {
  const loaded = normalizeComponentManifest({
    packageRoot: input.packageRoot,
    manifest: {
      ...input.manifest,
      kind: sourceKind
    },
    appVersion
  });

  return {
    name: loaded.manifest.name,
    version: loaded.manifest.version,
    sourceKind,
    packageRoot: loaded.packageRoot,
    packageChecksum: input.packageChecksum ?? null,
    manifest: loaded.manifest,
    isEnabled: true,
    isInstalled: sourceKind === 'external'
  };
};

export const createComponentRegistry = (
  options: CreateComponentRegistryOptions
): ComponentRegistry => {
  const { repository, appVersion } = options;

  const assertNoBuiltinCollision = (name: string, version: string): void => {
    const existing = repository.getComponentPackage(name, version);
    if (existing?.sourceKind === 'builtin') {
      throw new Error(`Cannot replace builtin component with installed package: ${name}@${version}`);
    }
  };

  return {
    registerBuiltinManifest: (input): ComponentRecord => {
      const record = repository.upsertComponentPackage(
        prepareUpsertInput(input, 'builtin', appVersion)
      );
      return mapRecord(record);
    },
    registerInstalledManifest: (input): ComponentRecord => {
      const upsertInput = prepareUpsertInput(input, 'external', appVersion);
      assertNoBuiltinCollision(upsertInput.name, upsertInput.version);
      const record = repository.upsertComponentPackage(upsertInput);
      return mapRecord(record);
    },
    listEnabledComponents: (): ComponentRecord[] => {
      return repository
        .listComponentPackages()
        .filter((record) => record.isEnabled && (record.sourceKind === 'builtin' || record.isInstalled))
        .map(mapRecord);
    },
    getExactComponent: (name, version): ComponentRecord | null => {
      const record = repository.getComponentPackage(name, version);
      return record ? mapRecord(record) : null;
    },
    disableBuiltinComponent: (name, version): void => {
      const record = repository.getComponentPackage(name, version);
      if (!record) {
        throw new Error(`Component not found: ${name}@${version}`);
      }
      if (record.sourceKind !== 'builtin') {
        throw new Error(`Only builtin components can be disabled: ${name}@${version}`);
      }
      repository.setComponentPackageStatus(name, version, {
        isEnabled: false,
        isInstalled: record.isInstalled
      });
    },
    uninstallExternalComponent: (name, version): void => {
      const record = repository.getComponentPackage(name, version);
      if (!record) {
        throw new Error(`Component not found: ${name}@${version}`);
      }
      if (record.sourceKind !== 'external') {
        throw new Error(`Only external components can be uninstalled: ${name}@${version}`);
      }
      repository.setComponentPackageStatus(name, version, {
        isEnabled: false,
        isInstalled: false
      });
    },
    resolveExactVersion: (name, version, mode): ComponentRecord | null => {
      const record = repository.getComponentPackage(name, version);
      if (!record) {
        return null;
      }
      const isEnabled = record.isEnabled && (record.sourceKind === 'builtin' || record.isInstalled);
      if (mode === 'enabled') {
        return isEnabled ? mapRecord(record) : null;
      }
      return isEnabled ? null : mapRecord(record);
    }
  };
};
