import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unmock('node-pty');
  vi.unmock('../../../src/worker/adapters/pty-runtime');
  vi.unmock('../../../src/worker/adapters/shell-runtime');
  vi.unmock('../../../src/worker/adapters/codex-runtime');
  vi.unmock('../../../src/worker/adapters/claude-runtime');
  vi.unmock('../../../src/worker/adapters/opencode-runtime');
  vi.unmock('node:child_process');
});

describe('runtime adapters', () => {
  it('accepts opencode as a supported run runtime', async () => {
    const { runRuntimeSchema } = await import('../../../src/shared/ipc/schemas');

    expect(runRuntimeSchema.parse('opencode')).toBe('opencode');
  });

  it('launchShellRuntime starts a PTY shell with the provided cwd and env', async () => {
    const ptyProcess = {
      pid: 1,
      write: vi.fn(),
      kill: vi.fn(),
      onData: vi.fn(),
      onExit: vi.fn()
    };
    const spawn = vi.fn(() => ptyProcess);
    vi.doMock('node-pty', () => ({
      spawn
    }));

    const { launchShellRuntime } = await import('../../../src/worker/adapters/shell-runtime');
    const env = { PATH: '/usr/bin', SystemRoot: 'C:\\Windows' } as NodeJS.ProcessEnv;
    const processRef = launchShellRuntime({
      command: 'echo hello',
      cwd: '/tmp/workspace',
      env
    });

    expect(processRef.pid).toBe(1);
    expect(processRef.write).toEqual(expect.any(Function));
    expect(processRef.kill).toEqual(expect.any(Function));
    expect(processRef.stdout).toBeInstanceOf(EventEmitter);
    expect(processRef.stderr).toBeInstanceOf(EventEmitter);

    if (process.platform === 'win32') {
      expect(spawn).toHaveBeenCalledWith(
        env.ComSpec ?? 'cmd.exe',
        ['/d', '/s', '/c', 'echo hello'],
        {
          cwd: '/tmp/workspace',
          env,
          name: 'xterm-color'
        }
      );
    } else {
      expect(spawn).toHaveBeenCalledWith(
        env.SHELL ?? process.env.SHELL ?? '/bin/sh',
        ['-lc', 'echo hello'],
        {
          cwd: '/tmp/workspace',
          env,
          name: 'xterm-color'
        }
      );
    }
  });

  it('falls back to child_process spawn when node-pty cannot launch the shell', async () => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      stdin: { write: ReturnType<typeof vi.fn> };
      pid: number;
      kill: ReturnType<typeof vi.fn>;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = {
      write: vi.fn()
    };
    child.pid = 22;
    child.kill = vi.fn();

    const spawnPty = vi.fn(() => {
      throw new Error('posix_spawnp failed.');
    });
    const spawnProcess = vi.fn(() => child);

    vi.doMock('node-pty', () => ({
      spawn: spawnPty
    }));
    vi.doMock('node:child_process', () => ({
      spawn: spawnProcess
    }));

    const { launchShellRuntime } = await import('../../../src/worker/adapters/shell-runtime');
    const env = { PATH: '/usr/bin', SystemRoot: 'C:\\Windows' } as NodeJS.ProcessEnv;
    const processRef = launchShellRuntime({
      command: 'echo hello',
      cwd: '/tmp/workspace',
      env
    });

    expect(processRef.pid).toBe(22);
    expect(spawnPty).toHaveBeenCalledTimes(1);
    expect(spawnProcess).toHaveBeenCalledWith(
      process.platform === 'win32'
        ? env.ComSpec ?? 'cmd.exe'
        : env.SHELL ?? process.env.SHELL ?? '/bin/sh',
      process.platform === 'win32' ? ['/d', '/s', '/c', 'echo hello'] : ['-lc', 'echo hello'],
      {
        cwd: '/tmp/workspace',
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      }
    );

    processRef.write('status\n');
    processRef.kill('SIGTERM');
    expect(child.stdin.write).toHaveBeenCalledWith('status\n');
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('prefixes codex, claude, and opencode commands and rejects empty commands', async () => {
    const launchShellRuntime = vi.fn(() => ({ pid: 2 }));
    vi.doMock('../../../src/worker/adapters/shell-runtime', () => ({
      launchShellRuntime
    }));

    const { launchClaudeRuntime } = await import('../../../src/worker/adapters/claude-runtime');
    const { launchCodexRuntime } = await import('../../../src/worker/adapters/codex-runtime');
    const { launchOpenCodeRuntime } = await import('../../../src/worker/adapters/opencode-runtime');

    launchClaudeRuntime({ command: 'run --help', env: {} });
    launchCodexRuntime({ command: 'exec', env: {} });
    launchOpenCodeRuntime({ command: 'run --help', env: {} });

    expect(launchShellRuntime).toHaveBeenNthCalledWith(1, {
      command: 'claude run --help',
      env: {}
    });
    expect(launchShellRuntime).toHaveBeenNthCalledWith(2, {
      command: 'codex exec',
      env: {}
    });
    expect(launchShellRuntime).toHaveBeenNthCalledWith(3, {
      command: 'opencode run --help',
      env: {}
    });
    expect(() => launchClaudeRuntime({ command: '   ', env: {} })).toThrow(
      'Claude runtime command cannot be empty'
    );
    expect(() => launchCodexRuntime({ command: '', env: {} })).toThrow(
      'Codex runtime command cannot be empty'
    );
    expect(() => launchOpenCodeRuntime({ command: ' ', env: {} })).toThrow(
      'OpenCode runtime command cannot be empty'
    );
  });

  it('routes shell, codex, claude, and opencode through the runtime worker launcher matrix', async () => {
    const launchShellRuntime = vi.fn(() => ({ pid: 3 }));
    const launchCodexRuntime = vi.fn(() => ({ pid: 4 }));
    const launchClaudeRuntime = vi.fn(() => ({ pid: 5 }));
    const launchOpenCodeRuntime = vi.fn(() => ({ pid: 6 }));
    vi.doMock('../../../src/worker/adapters/shell-runtime', () => ({
      launchShellRuntime
    }));
    vi.doMock('../../../src/worker/adapters/codex-runtime', () => ({
      launchCodexRuntime
    }));
    vi.doMock('../../../src/worker/adapters/claude-runtime', () => ({
      launchClaudeRuntime
    }));
    vi.doMock('../../../src/worker/adapters/opencode-runtime', () => ({
      launchOpenCodeRuntime
    }));
    vi.spyOn(process, 'on').mockImplementation(() => process);

    const { resolveRuntimeLauncher } = await import('../../../src/worker/runtime-worker');

    expect(resolveRuntimeLauncher('shell')({ command: 'echo hello', env: {} })).toEqual({ pid: 3 });
    expect(resolveRuntimeLauncher('codex')({ command: 'exec', env: {} })).toEqual({ pid: 4 });
    expect(resolveRuntimeLauncher('claude')({ command: 'run', env: {} })).toEqual({ pid: 5 });
    expect(resolveRuntimeLauncher('opencode')({ command: 'run --help', env: {} })).toEqual({ pid: 6 });

    expect(launchShellRuntime).toHaveBeenCalledWith({ command: 'echo hello', env: {} });
    expect(launchCodexRuntime).toHaveBeenCalledWith({ command: 'exec', env: {} });
    expect(launchClaudeRuntime).toHaveBeenCalledWith({ command: 'run', env: {} });
    expect(launchOpenCodeRuntime).toHaveBeenCalledWith({ command: 'run --help', env: {} });
  });

  it('surfaces a stable coded error for invalid runtime kinds', async () => {
    vi.spyOn(process, 'on').mockImplementation(() => process);

    const { resolveRuntimeLauncher, RuntimeWorkerError } = await import(
      '../../../src/worker/runtime-worker'
    );

    let thrownError: unknown;
    try {
      resolveRuntimeLauncher('invalid-runtime' as never);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(RuntimeWorkerError);
    expect(thrownError).toMatchObject({
      code: 'RUNTIME_UNSUPPORTED'
    });
    expect((thrownError as Error).message).toBe(
      '[RUNTIME_UNSUPPORTED] Unsupported runtime: invalid-runtime'
    );
  });
});
