import fs from 'node:fs';
import path from 'node:path';
import type { ComponentManifestV1 } from '../../shared/components/manifest';
import { componentManifestSchemaV1 } from '../../shared/components/manifest';

const manifestFileName = 'component.json';

export interface LoadedComponentManifest {
  packageRoot: string;
  manifestPath: string;
  manifest: ComponentManifestV1;
  entry: {
    renderer: string;
    worker: string;
  };
}

export interface LoadComponentManifestOptions {
  packageRoot: string;
  appVersion?: string;
}

interface SemverVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

const semverPattern =
  /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const supportedCompatibilityPattern =
  /^(>=|=)?\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const parseVersion = (value: string): SemverVersion => {
  const normalizedValue = value.trim();
  const match = normalizedValue.match(semverPattern);
  if (!match) {
    throw new Error(`Unsupported semver value: ${value}`);
  }

  return {
    major: Number.parseInt(match[1] ?? '0', 10),
    minor: Number.parseInt(match[2] ?? '0', 10),
    patch: Number.parseInt(match[3] ?? '0', 10),
    prerelease: match[4] ? match[4].split('.') : []
  };
};

const comparePrereleaseIdentifiers = (left: string, right: string): number => {
  const leftIsNumeric = /^\d+$/.test(left);
  const rightIsNumeric = /^\d+$/.test(right);

  if (leftIsNumeric && rightIsNumeric) {
    return Number.parseInt(left, 10) - Number.parseInt(right, 10);
  }
  if (leftIsNumeric) {
    return -1;
  }
  if (rightIsNumeric) {
    return 1;
  }
  return left.localeCompare(right);
};

const compareVersions = (left: SemverVersion, right: SemverVersion): number => {
  if (left.major !== right.major) {
    return left.major - right.major;
  }
  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }
  if (left.patch !== right.patch) {
    return left.patch - right.patch;
  }

  const leftHasPrerelease = left.prerelease.length > 0;
  const rightHasPrerelease = right.prerelease.length > 0;
  if (!leftHasPrerelease && !rightHasPrerelease) {
    return 0;
  }
  if (!leftHasPrerelease) {
    return 1;
  }
  if (!rightHasPrerelease) {
    return -1;
  }

  const maxLength = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftIdentifier = left.prerelease[index];
    const rightIdentifier = right.prerelease[index];

    if (leftIdentifier === undefined) {
      return -1;
    }
    if (rightIdentifier === undefined) {
      return 1;
    }

    const comparison = comparePrereleaseIdentifiers(leftIdentifier, rightIdentifier);
    if (comparison !== 0) {
      return comparison;
    }
  }

  return 0;
};

const isCompatibleWithVersion = (range: string, appVersion: string): boolean => {
  const normalizedRange = range.trim();
  if (!supportedCompatibilityPattern.test(normalizedRange)) {
    throw new Error(`Unsupported compatibility expression: ${range}`);
  }
  const currentVersion = parseVersion(appVersion);

  if (normalizedRange.startsWith('>=')) {
    return compareVersions(currentVersion, parseVersion(normalizedRange.slice(2))) >= 0;
  }

  if (normalizedRange.startsWith('=')) {
    return compareVersions(currentVersion, parseVersion(normalizedRange.slice(1))) === 0;
  }

  return compareVersions(currentVersion, parseVersion(normalizedRange)) === 0;
};

const readAppVersion = (): string => {
  const packageJsonPath = path.resolve(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { version?: string };
  if (!packageJson.version) {
    throw new Error(`App version not found in ${packageJsonPath}`);
  }
  return packageJson.version;
};

const toCanonicalPackageRoot = (packageRoot: string): string => {
  const resolvedPath = path.resolve(packageRoot);
  let canonicalPath: string;

  try {
    canonicalPath = fs.realpathSync(resolvedPath);
  } catch {
    throw new Error(`Component package root does not exist: ${resolvedPath}`);
  }

  const stats = fs.statSync(canonicalPath);
  if (!stats.isDirectory()) {
    throw new Error(`Component package root must be a directory: ${canonicalPath}`);
  }

  return canonicalPath;
};

const ensureInsidePackageRoot = (packageRoot: string, entryPath: string): string => {
  const absoluteEntryPath = path.resolve(packageRoot, entryPath);
  let canonicalEntryPath: string;

  try {
    canonicalEntryPath = fs.realpathSync(absoluteEntryPath);
  } catch {
    throw new Error(`Component entry does not exist: ${absoluteEntryPath}`);
  }

  const relativePath = path.relative(packageRoot, canonicalEntryPath);
  if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    throw new Error('Entry path must stay within the component package');
  }
  return canonicalEntryPath;
};

export const normalizeComponentManifest = (options: {
  packageRoot: string;
  manifest: unknown;
  appVersion?: string;
}): LoadedComponentManifest => {
  const packageRoot = toCanonicalPackageRoot(options.packageRoot);
  const manifestPath = path.join(packageRoot, manifestFileName);
  const manifest = componentManifestSchemaV1.parse(options.manifest);
  const appVersion = options.appVersion ?? readAppVersion();

  if (!isCompatibleWithVersion(manifest.compatibility.openweave, appVersion)) {
    throw new Error(
      `Component ${manifest.name}@${manifest.version} is not compatible with OpenWeave ${appVersion}`
    );
  }

  if (
    manifest.compatibility.platforms &&
    !manifest.compatibility.platforms.some((platform) => platform === process.platform)
  ) {
    throw new Error(`Component ${manifest.name}@${manifest.version} is not compatible with ${process.platform}`);
  }

  return {
    packageRoot,
    manifestPath,
    manifest,
    entry: {
      renderer: ensureInsidePackageRoot(packageRoot, manifest.entry.renderer),
      worker: ensureInsidePackageRoot(packageRoot, manifest.entry.worker)
    }
  };
};

export const loadComponentManifest = (
  options: LoadComponentManifestOptions
): LoadedComponentManifest => {
  const packageRoot = toCanonicalPackageRoot(options.packageRoot);
  const manifestPath = path.join(packageRoot, manifestFileName);
  const manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown;

  return normalizeComponentManifest({
    packageRoot,
    manifest: manifestJson,
    appVersion: options.appVersion
  });
};
