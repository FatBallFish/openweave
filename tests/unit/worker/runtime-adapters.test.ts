import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unmock('../../../src/worker/adapters/shell-runtime');
  vi.unmock('node:child_process');
});

describe('runtime adapters', () => {
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

  it('prefixes codex and claude commands and rejects empty commands', async () => {
    const launchShellRuntime = vi.fn(() => ({ pid: 2 }));
    vi.doMock('../../../src/worker/adapters/shell-runtime', () => ({
      launchShellRuntime
    }));

    const { launchClaudeRuntime } = await import('../../../src/worker/adapters/claude-runtime');
    const { launchCodexRuntime } = await import('../../../src/worker/adapters/codex-runtime');

    launchClaudeRuntime({ command: 'run --help', env: {} });
    launchCodexRuntime({ command: 'exec', env: {} });

    expect(launchShellRuntime).toHaveBeenNthCalledWith(1, {
      command: 'claude run --help',
      env: {}
    });
    expect(launchShellRuntime).toHaveBeenNthCalledWith(2, {
      command: 'codex exec',
      env: {}
    });
    expect(() => launchClaudeRuntime({ command: '   ', env: {} })).toThrow(
      'Claude runtime command cannot be empty'
    );
    expect(() => launchCodexRuntime({ command: '', env: {} })).toThrow(
      'Codex runtime command cannot be empty'
    );
  });
});
