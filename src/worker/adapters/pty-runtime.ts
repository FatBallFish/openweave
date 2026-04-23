import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { spawn, type IPty } from 'node-pty';

export interface RuntimeAdapterInput {
  command: string;
  cwd?: string;
  env: NodeJS.ProcessEnv;
}

export interface RuntimeAdapterProcess extends EventEmitter {
  pid: number | null;
  stdout: PassThrough;
  stderr: PassThrough;
  write: (input: string) => void;
  kill: (signal?: string) => void;
  resize: (cols: number, rows: number) => void;
}

const PTY_NAME = 'xterm-256color';

const resolveShellLaunch = (
  command: string,
  env: NodeJS.ProcessEnv
): { file: string; args: string[] } => {
  const trimmedCommand = command.trim();

  if (process.platform === 'win32') {
    return {
      file: env.ComSpec ?? 'cmd.exe',
      args: trimmedCommand.length === 0 ? [] : ['/d', '/s', '/c', command]
    };
  }

  const shell = env.SHELL ?? process.env.SHELL ?? '/bin/sh';
  const isInteractiveShell = /(?:bash|zsh|fish)$/.test(shell);
  return {
    file: shell,
    args:
      trimmedCommand.length === 0
        ? (isInteractiveShell ? ['-il'] : ['-i'])
        : (isInteractiveShell ? ['-ilc', command] : ['-lc', command])
  };
};

const toCloseSignal = (
  requestedSignal: string | null,
  signal: number | undefined
): NodeJS.Signals | null => {
  if (typeof signal !== 'number' || signal === 0) {
    return null;
  }

  return (requestedSignal ?? 'SIGTERM') as NodeJS.Signals;
};

const buildPtyEnv = (baseEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  return {
    ...baseEnv,
    TERM: PTY_NAME,
    COLORTERM: 'truecolor'
  };
};

interface NodePtySpawnHelperDeps {
  platform?: NodeJS.Platform;
  arch?: string;
  packageRoot?: string | null;
  existsSync?: (candidate: string) => boolean;
  statSync?: (candidate: string) => { mode: number };
  chmodSync?: (candidate: string, mode: number) => void;
}

const normalizeNodePtyPath = (candidate: string): string => {
  return candidate
    .replace('app.asar', 'app.asar.unpacked')
    .replace('node_modules.asar', 'node_modules.asar.unpacked');
};

const resolveNodePtyPackageRoot = (): string | null => {
  try {
    return path.dirname(require.resolve('node-pty/package.json'));
  } catch {
    return null;
  }
};

export const ensureNodePtySpawnHelperExecutable = (
  deps: NodePtySpawnHelperDeps = {}
): string | null => {
  const platform = deps.platform ?? process.platform;
  if (platform === 'win32') {
    return null;
  }

  const packageRoot = deps.packageRoot ?? resolveNodePtyPackageRoot();
  if (!packageRoot) {
    return null;
  }

  const existsSync = deps.existsSync ?? fs.existsSync;
  const statSync = deps.statSync ?? ((candidate: string) => fs.statSync(candidate));
  const chmodSync = deps.chmodSync ?? fs.chmodSync;
  const arch = deps.arch ?? process.arch;

  const candidates = [
    path.join(packageRoot, 'build', 'Release', 'spawn-helper'),
    path.join(packageRoot, 'build', 'Debug', 'spawn-helper'),
    path.join(packageRoot, 'prebuilds', `${platform}-${arch}`, 'spawn-helper')
  ].map(normalizeNodePtyPath);

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }

    const currentMode = statSync(candidate).mode & 0o777;
    if ((currentMode & 0o111) !== 0) {
      return candidate;
    }

    chmodSync(candidate, currentMode | 0o111);
    return candidate;
  }

  return null;
};

export const launchPtyRuntime = (input: RuntimeAdapterInput): RuntimeAdapterProcess => {
  const shell = resolveShellLaunch(input.command, input.env);
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let requestedSignal: string | null = null;
  const ptyEnv = buildPtyEnv(input.env);

  const runtimeProcess = new EventEmitter() as RuntimeAdapterProcess;
  runtimeProcess.stdout = stdout;
  runtimeProcess.stderr = stderr;

  ensureNodePtySpawnHelperExecutable();

  const terminal = spawn(shell.file, shell.args, {
    cwd: input.cwd,
    env: ptyEnv,
    name: PTY_NAME,
    cols: 80,
    rows: 24,
    encoding: 'utf8'
  });

  runtimeProcess.pid = terminal.pid ?? null;
  runtimeProcess.write = (value: string): void => {
    terminal.write(value);
  };
  runtimeProcess.kill = (signal?: string): void => {
    requestedSignal = signal ?? 'SIGTERM';
    terminal.kill(requestedSignal);
  };
  runtimeProcess.resize = (cols: number, rows: number): void => {
    try {
      terminal.resize(cols, rows);
    } catch {
      // PTY may not support resize
    }
  };

  terminal.onData((chunk: string) => {
    stdout.write(chunk);
  });

  terminal.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
    stdout.end();
    stderr.end();
    runtimeProcess.emit('close', exitCode, toCloseSignal(requestedSignal, signal));
  });

  return runtimeProcess;
};

export type PtyRuntimeTerminal = IPty;
