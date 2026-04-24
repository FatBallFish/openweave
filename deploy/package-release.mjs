#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { buildPackagePlan } = require('./package-plan.cjs');

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, '..');
const configPath = path.join(projectDir, 'deploy', 'electron-builder.release.yml');
const electronBuilderCliPath = path.join(projectDir, 'node_modules', 'electron-builder', 'cli.js');
const platformAliasMap = {
  mac: 'darwin',
  macos: 'darwin',
  darwin: 'darwin',
  linux: 'linux',
  win: 'win32',
  windows: 'win32',
  win32: 'win32'
};

const resolveNpmCommand = () => (process.platform === 'win32' ? 'npm.cmd' : 'npm');

const applyWindowsPackagingDefaults = () => {
  if (process.platform !== 'win32') {
    return;
  }

  process.env.ELECTRON_MIRROR ??= 'https://npmmirror.com/mirrors/electron/';
  process.env.ELECTRON_BUILDER_BINARIES_MIRROR ??= 'https://npmmirror.com/mirrors/electron-builder-binaries/';
};

const resolveElectronDist = () => {
  const electronDistDir = path.join(projectDir, 'node_modules', 'electron', 'dist');
  const electronExecutableName = process.platform === 'win32' ? 'electron.exe' : 'Electron';
  const electronExecutablePath = path.join(electronDistDir, electronExecutableName);

  if (fs.existsSync(electronExecutablePath)) {
    return electronDistDir;
  }

  return null;
};

const resolveRequestedPlatform = (rawPlatform) => {
  if (!rawPlatform) {
    return process.platform;
  }

  const normalized = platformAliasMap[rawPlatform.toLowerCase()];
  if (!normalized) {
    throw new Error(`Unsupported packaging platform input: ${rawPlatform}`);
  }

  return normalized;
};

const runCommand = (command, args, options = {}) => {
  let executable = command;
  let commandArgs = args;

  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(command)) {
    executable = 'cmd.exe';
    commandArgs = ['/d', '/s', '/c', command, ...args];
  }

  const result = spawnSync(executable, commandArgs, {
    cwd: projectDir,
    stdio: 'inherit',
    ...options
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const renderedArgs = args.join(' ');
    throw new Error(`Command failed: ${command} ${renderedArgs}`);
  }
};

const isRetryableFsError = (error) =>
  error &&
  typeof error === 'object' &&
  ['EBUSY', 'ENOTEMPTY', 'EPERM'].includes(error.code);

const sleep = (durationMs) => {
  const sharedArray = new SharedArrayBuffer(4);
  const view = new Int32Array(sharedArray);
  Atomics.wait(view, 0, 0, durationMs);
};

const stopWindowsProcessesForPath = (targetPath) => {
  if (process.platform !== 'win32') {
    return;
  }

  const normalizedTargetPath = path.resolve(targetPath).replace(/'/g, "''");
  const stopScript = [
    `$target = '${normalizedTargetPath}'`,
    "Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith($target, [System.StringComparison]::OrdinalIgnoreCase) } | Stop-Process -Force"
  ].join('; ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', stopScript], {
    stdio: 'inherit'
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Failed to stop Windows processes for ${targetPath}`);
  }
};

const removePathWithRetry = (targetPath, retries = 6, delayMs = 250) => {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!isRetryableFsError(error) || attempt === retries) {
        throw error;
      }
      sleep(delayMs * (attempt + 1));
    }
  }
};

const resetOutputDirectory = (outputDir) => {
  fs.mkdirSync(outputDir, { recursive: true });

  for (const childName of fs.readdirSync(outputDir)) {
    const childPath = path.join(outputDir, childName);
    stopWindowsProcessesForPath(childPath);
    removePathWithRetry(childPath);
  }
};

const requestedPlatform = resolveRequestedPlatform(process.argv[2]);
const requestedArch = process.env.OPENWEAVE_PACKAGE_ARCH ?? process.arch;
applyWindowsPackagingDefaults();
if (requestedPlatform !== process.platform) {
  throw new Error(
    `Packaging target ${requestedPlatform} must run on a matching host platform. Current host: ${process.platform}`
  );
}
const plan = buildPackagePlan({
  platform: requestedPlatform,
  arch: requestedArch,
  projectDir
});

if (!fs.existsSync(electronBuilderCliPath)) {
  throw new Error(`electron-builder CLI not found: ${electronBuilderCliPath}`);
}

resetOutputDirectory(plan.outputDir);

console.log(`[package-release] Building OpenWeave for ${plan.platformName} (${requestedArch})...`);
runCommand(resolveNpmCommand(), ['run', 'build']);

console.log(`[package-release] Packaging artifacts into ${plan.outputDir}...`);
const builderArgs = [
  electronBuilderCliPath,
  '--config',
  configPath,
  ...plan.builderArgs,
  '--publish',
  'never',
  `-c.directories.output=${plan.outputDir}`
];
const electronDist = resolveElectronDist();
if (electronDist) {
  console.log(`[package-release] Using local Electron dist: ${electronDist}`);
  builderArgs.push(`-c.electronDist=${electronDist}`);
}

runCommand(process.execPath, builderArgs);

console.log(`[package-release] Done: ${plan.outputDir}`);
