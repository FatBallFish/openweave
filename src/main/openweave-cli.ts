import path from 'node:path';
import fs from 'node:fs';

export interface OpenWeaveCliAssets {
  commandPath: string | null;
  commandDirectory: string | null;
  entryPath: string | null;
  runtimePath: string;
}

export interface ResolveOpenWeaveCliAssetsOptions {
  appIsPackaged: boolean;
  runtimeDir?: string;
  executablePath: string;
  processPlatform?: NodeJS.Platform;
  pathExists?: (candidate: string) => boolean;
}

export interface BuildOpenWeaveCliLaunchEnvOptions {
  baseEnv: NodeJS.ProcessEnv;
  cli: OpenWeaveCliAssets;
}

interface OpenWeaveCliCandidate {
  commandPath: string;
  entryPath: string;
}

const resolveWrapperName = (platform: NodeJS.Platform): string => {
  return platform === 'win32' ? 'openweave.cmd' : 'openweave';
};

const prependPathEntry = (currentPath: string | undefined, nextEntry: string): string => {
  if (!currentPath || currentPath.length === 0) {
    return nextEntry;
  }

  const entries = currentPath.split(path.delimiter);
  if (entries.includes(nextEntry)) {
    return currentPath;
  }

  return [nextEntry, currentPath].join(path.delimiter);
};

const buildPackagedCliCandidates = (
  executablePath: string,
  wrapperName: string
): OpenWeaveCliCandidate[] => {
  const executableDir = path.dirname(executablePath);
  return [
    {
      commandPath: path.join(executableDir, 'resources', 'bin', wrapperName),
      entryPath: path.join(executableDir, 'resources', 'app', 'dist', 'cli', 'index.js')
    },
    {
      commandPath: path.join(executableDir, '..', 'Resources', 'bin', wrapperName),
      entryPath: path.join(executableDir, '..', 'Resources', 'app', 'dist', 'cli', 'index.js')
    }
  ];
};

const buildDevelopmentCliCandidates = (
  runtimeDir: string,
  wrapperName: string
): OpenWeaveCliCandidate[] => {
  const projectRoot = path.resolve(runtimeDir, '..', '..');
  return [
    {
      commandPath: path.join(projectRoot, 'bin', wrapperName),
      entryPath: path.join(projectRoot, 'dist', 'cli', 'index.js')
    }
  ];
};

export const resolveOpenWeaveCliAssets = (
  options: ResolveOpenWeaveCliAssetsOptions
): OpenWeaveCliAssets => {
  const platform = options.processPlatform ?? process.platform;
  const runtimeDir = options.runtimeDir ?? __dirname;
  const pathExists = options.pathExists ?? fs.existsSync;
  const wrapperName = resolveWrapperName(platform);
  const candidates = options.appIsPackaged
    ? buildPackagedCliCandidates(options.executablePath, wrapperName)
    : buildDevelopmentCliCandidates(runtimeDir, wrapperName);

  const resolvedCandidate =
    candidates.find((candidate) => pathExists(candidate.commandPath) && pathExists(candidate.entryPath)) ?? null;
  const commandPath = resolvedCandidate?.commandPath ?? null;
  const entryPath = resolvedCandidate?.entryPath ?? null;

  return {
    commandPath,
    commandDirectory: commandPath ? path.dirname(commandPath) : null,
    entryPath,
    runtimePath: options.executablePath
  };
};

export const buildOpenWeaveCliLaunchEnv = (
  options: BuildOpenWeaveCliLaunchEnvOptions
): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {
    ...options.baseEnv
  };

  if (options.cli.commandDirectory) {
    env.PATH = prependPathEntry(env.PATH, options.cli.commandDirectory);
  }
  if (options.cli.commandPath) {
    env.OPENWEAVE_CLI = options.cli.commandPath;
  }
  if (options.cli.entryPath) {
    env.OPENWEAVE_CLI_ENTRY = options.cli.entryPath;
  }
  env.OPENWEAVE_CLI_RUNTIME = options.cli.runtimePath;

  return env;
};
