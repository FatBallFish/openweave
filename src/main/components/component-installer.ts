import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ComponentRecord, ComponentRegistry } from './component-registry';
import { loadComponentManifest } from './manifest-loader';

type ExtractZipFn = (archivePath: string, options: { dir: string }) => Promise<void>;
const extractZip = require('extract-zip') as ExtractZipFn;

export interface CreateComponentInstallerOptions {
  componentRegistry: ComponentRegistry;
  installRoot: string;
  tempRoot?: string;
  appVersion?: string;
}

export interface InstallComponentFromDirectoryInput {
  packageRoot: string;
}

export interface InstallComponentFromZipInput {
  archivePath: string;
}

export interface ComponentInstaller {
  installFromDirectory: (input: InstallComponentFromDirectoryInput) => Promise<ComponentRecord>;
  installFromZip: (input: InstallComponentFromZipInput) => Promise<ComponentRecord>;
  uninstallExternalComponent: (name: string, version: string) => void;
}

interface PreparedInstall {
  packageRoot: string;
  manifest: ReturnType<typeof loadComponentManifest>['manifest'];
  packageChecksum: string;
}

interface PreviousInstallState {
  packageRoot: string;
  manifest: ReturnType<typeof loadComponentManifest>['manifest'];
  packageChecksum: string;
  isEnabled: boolean;
  isInstalled: boolean;
}

const collectPackageEntries = (rootDir: string, currentDir: string, entries: string[]): void => {
  const childNames = fs.readdirSync(currentDir).sort((left, right) => left.localeCompare(right));

  for (const childName of childNames) {
    const entryPath = path.join(currentDir, childName);
    const relativePath = path.relative(rootDir, entryPath);
    const stats = fs.lstatSync(entryPath);

    entries.push(relativePath);
    if (stats.isDirectory()) {
      collectPackageEntries(rootDir, entryPath, entries);
    }
  }
};

const computePackageChecksum = (packageRoot: string): string => {
  const hash = crypto.createHash('sha256');
  const entries: string[] = [];
  collectPackageEntries(packageRoot, packageRoot, entries);

  for (const relativePath of entries) {
    const absolutePath = path.join(packageRoot, relativePath);
    const stats = fs.lstatSync(absolutePath);

    hash.update(relativePath);
    if (stats.isSymbolicLink()) {
      hash.update('symlink');
      hash.update(fs.readlinkSync(absolutePath));
      continue;
    }
    if (stats.isDirectory()) {
      hash.update('directory');
      continue;
    }

    hash.update('file');
    hash.update(fs.readFileSync(absolutePath));
  }

  return hash.digest('hex');
};

const copyDirectory = (sourceRoot: string, targetRoot: string): void => {
  fs.mkdirSync(path.dirname(targetRoot), { recursive: true });
  fs.cpSync(sourceRoot, targetRoot, { recursive: true, force: true, errorOnExist: false });
};

export const findComponentPackageRoot = (searchRoot: string): string => {
  const canonicalSearchRoot = fs.realpathSync(path.resolve(searchRoot));
  const matches: string[] = [];
  const visited = new Set<string>();
  const pending = [canonicalSearchRoot];

  while (pending.length > 0) {
    const directoryPath = pending.pop();
    if (!directoryPath) {
      continue;
    }

    const canonicalDirectoryPath = fs.realpathSync(directoryPath);
    if (visited.has(canonicalDirectoryPath)) {
      continue;
    }
    visited.add(canonicalDirectoryPath);

    const manifestPath = path.join(directoryPath, 'component.json');
    if (fs.existsSync(manifestPath)) {
      const manifestStats = fs.lstatSync(manifestPath);
      if (manifestStats.isFile()) {
        matches.push(directoryPath);
      }
    }

    const childNames = fs.readdirSync(directoryPath).sort((left, right) => left.localeCompare(right));
    for (const childName of childNames) {
      const childPath = path.join(directoryPath, childName);
      const childStats = fs.lstatSync(childPath);
      if (childStats.isSymbolicLink() || !childStats.isDirectory()) {
        continue;
      }
      pending.push(childPath);
    }
  }

  if (matches.length === 0) {
    throw new Error(`Component package not found in archive: ${canonicalSearchRoot}`);
  }
  if (matches.length > 1) {
    throw new Error(`Archive must contain exactly one component package: ${canonicalSearchRoot}`);
  }
  return matches[0];
};

const prepareInstallFromPackageRoot = (packageRoot: string, appVersion?: string): PreparedInstall => {
  const loaded = loadComponentManifest({ packageRoot, appVersion });
  return {
    packageRoot: loaded.packageRoot,
    manifest: loaded.manifest,
    packageChecksum: computePackageChecksum(loaded.packageRoot)
  };
};

const preparePreviousInstallState = (input: {
  packageRoot: string;
  packageChecksum: string | null;
  isEnabled: boolean;
  isInstalled: boolean;
  appVersion?: string;
}): PreviousInstallState => {
  const loaded = loadComponentManifest({
    packageRoot: input.packageRoot,
    appVersion: input.appVersion
  });
  return {
    packageRoot: loaded.packageRoot,
    manifest: loaded.manifest,
    packageChecksum: input.packageChecksum ?? computePackageChecksum(loaded.packageRoot),
    isEnabled: input.isEnabled,
    isInstalled: input.isInstalled
  };
};

const installPreparedPackage = (
  componentRegistry: ComponentRegistry,
  installRoot: string,
  prepared: PreparedInstall,
  appVersion?: string
): ComponentRecord => {
  const existing = componentRegistry.getExactComponent(prepared.manifest.name, prepared.manifest.version);
  if (existing?.sourceKind === 'builtin') {
    throw new Error(
      `Cannot replace builtin component with installed package: ${prepared.manifest.name}@${prepared.manifest.version}`
    );
  }
  if (
    existing &&
    existing.packageChecksum === prepared.packageChecksum &&
    existing.isInstalled &&
    existing.isEnabled
  ) {
    return existing;
  }

  const targetRoot = path.join(
    path.resolve(installRoot),
    prepared.manifest.name,
    prepared.manifest.version
  );
  const stagingRoot = path.join(
    path.resolve(installRoot),
    '.staging',
    `${prepared.manifest.name}-${prepared.manifest.version}-${crypto.randomUUID()}`
  );
  const backupRoot = `${targetRoot}.backup-${crypto.randomUUID()}`;

  let hasBackup = false;
  let movedToTarget = false;
  let registryUpdated = false;
  let previousInstallState: PreviousInstallState | null = null;

  try {
    copyDirectory(prepared.packageRoot, stagingRoot);

    if (fs.existsSync(targetRoot)) {
      previousInstallState = existing
        ? preparePreviousInstallState({
            packageRoot: targetRoot,
            packageChecksum: existing.packageChecksum,
            isEnabled: existing.isEnabled,
            isInstalled: existing.isInstalled,
            appVersion
          })
        : preparePreviousInstallState({
            packageRoot: targetRoot,
            packageChecksum: null,
            isEnabled: true,
            isInstalled: true,
            appVersion
          });
      fs.renameSync(targetRoot, backupRoot);
      hasBackup = true;
    }

    fs.mkdirSync(path.dirname(targetRoot), { recursive: true });
    fs.renameSync(stagingRoot, targetRoot);
    movedToTarget = true;

    const installed = componentRegistry.registerInstalledManifest({
      packageRoot: targetRoot,
      manifest: prepared.manifest,
      packageChecksum: prepared.packageChecksum
    });
    registryUpdated = true;

    if (hasBackup) {
      fs.rmSync(backupRoot, { recursive: true, force: true });
    }

    return installed;
  } catch (error) {
    if (fs.existsSync(stagingRoot)) {
      fs.rmSync(stagingRoot, { recursive: true, force: true });
    }
    if (movedToTarget && fs.existsSync(targetRoot)) {
      fs.rmSync(targetRoot, { recursive: true, force: true });
    }
    if (hasBackup && fs.existsSync(backupRoot)) {
      fs.mkdirSync(path.dirname(targetRoot), { recursive: true });
      fs.renameSync(backupRoot, targetRoot);
    }
    if (registryUpdated) {
      if (previousInstallState) {
        const restored = componentRegistry.registerInstalledManifest({
          packageRoot: previousInstallState.packageRoot,
          manifest: previousInstallState.manifest,
          packageChecksum: previousInstallState.packageChecksum
        });
        if (!previousInstallState.isEnabled || !previousInstallState.isInstalled) {
          componentRegistry.uninstallExternalComponent(restored.name, restored.version);
        }
      } else {
        componentRegistry.uninstallExternalComponent(prepared.manifest.name, prepared.manifest.version);
      }
    }
    throw error;
  }
};

export const createComponentInstaller = (
  options: CreateComponentInstallerOptions
): ComponentInstaller => {
  const installRoot = path.resolve(options.installRoot);
  const tempRoot = path.resolve(options.tempRoot ?? os.tmpdir());

  return {
    installFromDirectory: async (input): Promise<ComponentRecord> => {
      const prepared = prepareInstallFromPackageRoot(input.packageRoot, options.appVersion);
      return installPreparedPackage(options.componentRegistry, installRoot, prepared, options.appVersion);
    },
    installFromZip: async (input): Promise<ComponentRecord> => {
      const extractionRoot = fs.mkdtempSync(path.join(tempRoot, 'openweave-component-install-'));

      try {
        await extractZip(path.resolve(input.archivePath), { dir: extractionRoot });
        const packageRoot = findComponentPackageRoot(extractionRoot);
        const prepared = prepareInstallFromPackageRoot(packageRoot, options.appVersion);
        return installPreparedPackage(options.componentRegistry, installRoot, prepared, options.appVersion);
      } finally {
        fs.rmSync(extractionRoot, { recursive: true, force: true });
      }
    },
    uninstallExternalComponent: (name, version): void => {
      options.componentRegistry.uninstallExternalComponent(name, version);
    }
  };
};
