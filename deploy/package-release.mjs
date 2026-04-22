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

fs.rmSync(plan.outputDir, { recursive: true, force: true });
fs.mkdirSync(plan.outputDir, { recursive: true });

console.log(`[package-release] Building OpenWeave for ${plan.platformName} (${requestedArch})...`);
runCommand(resolveNpmCommand(), ['run', 'build']);

console.log(`[package-release] Packaging artifacts into ${plan.outputDir}...`);
runCommand(process.execPath, [
  electronBuilderCliPath,
  '--config',
  configPath,
  ...plan.builderArgs,
  '--publish',
  'never',
  `-c.directories.output=${plan.outputDir}`
]);

console.log(`[package-release] Done: ${plan.outputDir}`);
