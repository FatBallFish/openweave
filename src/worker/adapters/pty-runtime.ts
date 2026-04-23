import { EventEmitter } from 'node:events';
import { spawn as spawnChildProcess } from 'node:child_process';
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

const PTY_NAME = 'xterm-color';

const resolveShellLaunch = (
  command: string,
  env: NodeJS.ProcessEnv
): { file: string; args: string[] } => {
  if (process.platform === 'win32') {
    return {
      file: env.ComSpec ?? 'cmd.exe',
      args: ['/d', '/s', '/c', command]
    };
  }

  return {
    file: env.SHELL ?? process.env.SHELL ?? '/bin/sh',
    args: ['-lc', command]
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

export const launchPtyRuntime = (input: RuntimeAdapterInput): RuntimeAdapterProcess => {
  const shell = resolveShellLaunch(input.command, input.env);
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let requestedSignal: string | null = null;

  const runtimeProcess = new EventEmitter() as RuntimeAdapterProcess;
  runtimeProcess.stdout = stdout;
  runtimeProcess.stderr = stderr;
  try {
    const terminal = spawn(shell.file, shell.args, {
      cwd: input.cwd,
      env: input.env,
      name: PTY_NAME
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
  } catch {
    const child = spawnChildProcess(shell.file, shell.args, {
      cwd: input.cwd,
      env: input.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    runtimeProcess.pid = child.pid ?? null;
    runtimeProcess.write = (value: string): void => {
      child.stdin?.write(value);
    };
    runtimeProcess.kill = (signal?: string): void => {
      requestedSignal = signal ?? 'SIGTERM';
      child.kill(requestedSignal as NodeJS.Signals);
    };
    runtimeProcess.resize = (): void => {
      // child_process.spawn fallback does not support resize
    };

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout.write(chunk);
    });
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr.write(chunk);
    });
    child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      stdout.end();
      stderr.end();
      runtimeProcess.emit('close', code, signal ?? null);
    });
    child.on('error', (error: Error) => {
      stderr.write(`${error.message}\n`);
    });
  }

  return runtimeProcess;
};

export type PtyRuntimeTerminal = IPty;
