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

  it('launchShellRuntime disables zsh prompt-sp when starting a PTY shell with a command', async () => {
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
    const env = { PATH: '/usr/bin', SHELL: '/bin/zsh', SystemRoot: 'C:\\Windows' } as NodeJS.ProcessEnv;
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
        expect.objectContaining({
          cwd: '/tmp/workspace',
          name: 'xterm-256color',
          cols: 80,
          rows: 24,
          encoding: 'utf8'
        })
      );
    } else {
      expect(spawn).toHaveBeenCalledWith(
        '/bin/zsh',
        ['-o', 'no_prompt_sp', '-ilc', 'echo hello'],
        expect.objectContaining({
          cwd: '/tmp/workspace',
          name: 'xterm-256color',
          cols: 80,
          rows: 24,
          encoding: 'utf8'
        })
      );
    }
  });

  it('launchShellRuntime keeps an empty command interactive instead of exiting immediately', async () => {
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
    const env = { PATH: '/usr/bin', SHELL: '/bin/zsh' } as NodeJS.ProcessEnv;

    launchShellRuntime({
      command: '   ',
      cwd: '/tmp/workspace',
      env
    });

    if (process.platform === 'win32') {
      expect(spawn).toHaveBeenCalledWith(
        env.ComSpec ?? 'cmd.exe',
        [],
        expect.objectContaining({
          cwd: '/tmp/workspace',
          name: 'xterm-256color'
        })
      );
    } else {
      expect(spawn).toHaveBeenCalledWith(
        '/bin/zsh',
        ['-o', 'no_prompt_sp', '-il'],
        expect.objectContaining({
          cwd: '/tmp/workspace',
          name: 'xterm-256color'
        })
      );
    }
  });

  it('launchShellRuntime keeps non-zsh interactive shells unchanged', async () => {
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
    const env = { PATH: '/usr/bin', SHELL: '/bin/sh' } as NodeJS.ProcessEnv;

    launchShellRuntime({
      command: '   ',
      cwd: '/tmp/workspace',
      env
    });

    if (process.platform === 'win32') {
      expect(spawn).toHaveBeenCalledWith(
        env.ComSpec ?? 'cmd.exe',
        [],
        expect.objectContaining({
          cwd: '/tmp/workspace',
          name: 'xterm-256color'
        })
      );
    } else {
      expect(spawn).toHaveBeenCalledWith(
        '/bin/sh',
        ['-i'],
        expect.objectContaining({
          cwd: '/tmp/workspace',
          name: 'xterm-256color'
        })
      );
    }
  });

  it('repairs node-pty spawn-helper execute permission before launching a PTY', async () => {
    const { ensureNodePtySpawnHelperExecutable } = await import('../../../src/worker/adapters/pty-runtime');
    const chmodSync = vi.fn();

    const helperPath = ensureNodePtySpawnHelperExecutable({
      platform: 'darwin',
      arch: 'arm64',
      packageRoot: '/tmp/node-pty',
      existsSync: (candidate) => candidate === '/tmp/node-pty/prebuilds/darwin-arm64/spawn-helper',
      statSync: () => ({ mode: 0o644 }),
      chmodSync
    });

    expect(helperPath).toBe('/tmp/node-pty/prebuilds/darwin-arm64/spawn-helper');
    expect(chmodSync).toHaveBeenCalledWith(
      '/tmp/node-pty/prebuilds/darwin-arm64/spawn-helper',
      0o755
    );
  });

  it('throws when node-pty cannot allocate a PTY', async () => {
    const spawnPty = vi.fn(() => {
      throw new Error('posix_spawnp failed.');
    });

    vi.doMock('node-pty', () => ({
      spawn: spawnPty
    }));

    const { launchShellRuntime } = await import('../../../src/worker/adapters/shell-runtime');
    const env = { PATH: '/usr/bin', SystemRoot: 'C:\\Windows' } as NodeJS.ProcessEnv;

    expect(() =>
      launchShellRuntime({
        command: 'echo hello',
        cwd: '/tmp/workspace',
        env
      })
    ).toThrow('posix_spawnp failed.');

    expect(spawnPty).toHaveBeenCalledTimes(1);
  });

  it('boots codex, claude, and opencode inside a persistent interactive shell', async () => {
    vi.useFakeTimers();
    const launchShellRuntime = vi.fn(() => ({
      pid: 2,
      write: vi.fn(),
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      on: vi.fn()
    }));
    vi.doMock('../../../src/worker/adapters/shell-runtime', () => ({
      launchShellRuntime
    }));

    const { launchClaudeRuntime } = await import('../../../src/worker/adapters/claude-runtime');
    const { launchCodexRuntime } = await import('../../../src/worker/adapters/codex-runtime');
    const { launchOpenCodeRuntime } = await import('../../../src/worker/adapters/opencode-runtime');

    const claude = launchClaudeRuntime({ command: 'run --help', env: {} });
    const codex = launchCodexRuntime({ command: 'exec', env: {} });
    const opencode = launchOpenCodeRuntime({ command: 'run --help', env: {} });

    expect(launchShellRuntime).toHaveBeenNthCalledWith(1, {
      command: '',
      env: {}
    });
    expect(launchShellRuntime).toHaveBeenNthCalledWith(2, {
      command: '',
      env: {}
    });
    expect(launchShellRuntime).toHaveBeenNthCalledWith(3, {
      command: '',
      env: {}
    });

    vi.runAllTimers();

    expect(claude.write).toHaveBeenCalledWith('run --help\r');
    expect(codex.write).toHaveBeenCalledWith('exec\r');
    expect(opencode.write).toHaveBeenCalledWith('run --help\r');
    vi.useRealTimers();
  });

  it('uses runtime defaults as startup commands for empty managed-runtime input', async () => {
    vi.useFakeTimers();
    const launchShellRuntime = vi.fn(() => ({
      pid: 2,
      write: vi.fn(),
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      on: vi.fn()
    }));
    vi.doMock('../../../src/worker/adapters/shell-runtime', () => ({
      launchShellRuntime
    }));

    const { launchClaudeRuntime } = await import('../../../src/worker/adapters/claude-runtime');
    const { launchCodexRuntime } = await import('../../../src/worker/adapters/codex-runtime');
    const { launchOpenCodeRuntime } = await import('../../../src/worker/adapters/opencode-runtime');

    const claude = launchClaudeRuntime({ command: '   ', env: {} });
    const codex = launchCodexRuntime({ command: '', env: {} });
    const opencode = launchOpenCodeRuntime({ command: ' ', env: {} });

    expect(launchShellRuntime).toHaveBeenNthCalledWith(1, {
      command: '',
      env: {}
    });
    expect(launchShellRuntime).toHaveBeenNthCalledWith(2, {
      command: '',
      env: {}
    });
    expect(launchShellRuntime).toHaveBeenNthCalledWith(3, {
      command: '',
      env: {}
    });

    vi.runAllTimers();

    expect(claude.write).toHaveBeenCalledWith('claude\r');
    expect(codex.write).toHaveBeenCalledWith('codex\r');
    expect(opencode.write).toHaveBeenCalledWith('opencode\r');
    vi.useRealTimers();
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
