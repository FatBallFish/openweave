import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
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

  it('launchShellRuntime spawns a shell process with the provided cwd and env', async () => {
    const spawn = vi.fn(() => ({ pid: 1 }));
    vi.doMock('node:child_process', () => ({
      spawn
    }));

    const { launchShellRuntime } = await import('../../../src/worker/adapters/shell-runtime');
    const env = { PATH: '/usr/bin' } as NodeJS.ProcessEnv;
    const processRef = launchShellRuntime({
      command: 'echo hello',
      cwd: '/tmp/workspace',
      env
    });

    expect(processRef).toEqual({ pid: 1 });
    expect(spawn).toHaveBeenCalledWith('echo hello', {
      cwd: '/tmp/workspace',
      env,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
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

  it('routes opencode through the runtime worker launcher matrix', async () => {
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
    const launcher = resolveRuntimeLauncher('opencode');

    const runtimeProcess = launcher({
      command: 'run --help',
      env: {}
    });

    expect(runtimeProcess).toEqual({ pid: 6 });
    expect(launchOpenCodeRuntime).toHaveBeenCalledWith({
      command: 'run --help',
      env: {}
    });
    expect(launchShellRuntime).not.toHaveBeenCalled();
    expect(launchCodexRuntime).not.toHaveBeenCalled();
    expect(launchClaudeRuntime).not.toHaveBeenCalled();
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
