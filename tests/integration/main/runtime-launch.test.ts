import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import {
  createRunsIpcHandlers,
  disposeRunsForWorkspace,
  disposeRunsIpcHandlers,
  registerRunsIpcHandlers
} from '../../../src/main/ipc/runs';
import { IPC_CHANNELS } from '../../../src/shared/ipc/contracts';
import { createRegistryRepository } from '../../../src/main/db/registry';
import { RuntimeWorkerError } from '../../../src/worker/runtime-worker';
import { createRuntimeBridge, type RuntimeBridge, type RuntimeStartRequest } from '../../../src/main/runtime/runtime-bridge';

class HoldRuntimeBridge extends EventEmitter implements RuntimeBridge {
  public readonly startRequests: RuntimeStartRequest[] = [];
  public readonly launchArtifacts: Array<{ agentsExists: boolean; skillExists: boolean }> = [];

  public start(request: RuntimeStartRequest): void {
    this.startRequests.push(request);
    const cwd = request.cwd ?? '';
    this.launchArtifacts.push({
      agentsExists: fs.existsSync(path.join(cwd, 'AGENTS.md')),
      skillExists: fs.existsSync(path.join(cwd, '.opencode', 'skills', 'openweave-workspace.md'))
    });
  }

  public input(_runId: string, _input: string): boolean {
    return true;
  }

  public stop(_runId: string): boolean {
    return true;
  }

  public dispose(): void {
    this.removeAllListeners();
  }
}

class IpcMainStub {
  public readonly handlers = new Map<string, (...args: any[]) => unknown>();

  public handle(channel: string, listener: (...args: any[]) => unknown): void {
    this.handlers.set(channel, listener);
  }

  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  public async invoke(channel: string, payload: unknown): Promise<any> {
    const handler = this.handlers.get(channel);
    if (!handler) {
      throw new Error(`IPC handler not registered: ${channel}`);
    }
    return handler({} as IpcMainInvokeEvent, payload);
  }
}

const createdPaths: string[] = [];

const mkdtemp = (prefix: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  createdPaths.push(dir);
  return dir;
};

afterEach(() => {
  disposeRunsIpcHandlers();
  while (createdPaths.length > 0) {
    fs.rmSync(createdPaths.pop()!, { recursive: true, force: true });
  }
});

describe('runtime launch', () => {
  it('runs preflight before runtime bridge start for in-memory handlers', async () => {
    const callOrder: string[] = [];
    const runtimeBridge = new HoldRuntimeBridge();
    const handlers = createRunsIpcHandlers({
      assertWorkspaceExists: () => undefined,
      resolveWorkspaceRootDir: () => '/tmp/runtime-launch-workspace',
      runtimeBridge,
      prepareRuntimeLaunch: (input) => {
        callOrder.push(`preflight:${input.runtime}`);
      }
    });

    await handlers.startRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-runtime-launch',
      nodeId: 'terminal-1',
      runtime: 'opencode',
      command: 'run --help'
    });

    expect(callOrder).toEqual(['preflight:opencode']);
    expect(runtimeBridge.startRequests).toHaveLength(1);
    expect(runtimeBridge.startRequests[0]).toMatchObject({
      runtime: 'opencode',
      cwd: '/tmp/runtime-launch-workspace'
    });
  });

  it('prepares managed opencode skill files before the registered launch bridge starts', async () => {
    const testDir = mkdtemp('openweave-runtime-launch-');
    const dbFilePath = path.join(testDir, 'registry.sqlite');
    const workspaceDbDir = path.join(testDir, 'workspaces');
    const workspaceRoot = path.join(testDir, 'workspace-root');
    fs.mkdirSync(workspaceDbDir, { recursive: true });
    fs.mkdirSync(workspaceRoot, { recursive: true });

    const registry = createRegistryRepository({ dbFilePath });
    const workspace = registry.createWorkspace({
      name: 'Runtime Launch Workspace',
      rootDir: workspaceRoot
    });
    registry.close();

    const ipcMain = new IpcMainStub();
    const runtimeBridge = new HoldRuntimeBridge();
    registerRunsIpcHandlers({
      dbFilePath,
      workspaceDbDir,
      ipcMain,
      runtimeBridge
    });

    await ipcMain.invoke(IPC_CHANNELS.runStart, {
      workspaceId: workspace.id,
      nodeId: 'terminal-1',
      runtime: 'opencode',
      command: 'run --help'
    });

    expect(runtimeBridge.startRequests).toHaveLength(1);
    expect(runtimeBridge.launchArtifacts).toEqual([
      {
        agentsExists: true,
        skillExists: true
      }
    ]);
    expect(fs.readFileSync(path.join(workspaceRoot, 'AGENTS.md'), 'utf8')).toContain('runtime: opencode');
    expect(
      fs.readFileSync(path.join(workspaceRoot, '.opencode', 'skills', 'openweave-workspace.md'), 'utf8')
    ).toContain('Use the OpenWeave bridge');
  });

  it('blocks switching to a different managed runtime while an earlier managed runtime is still active', async () => {
    const preflightCalls: string[] = [];
    const runtimeBridge = new HoldRuntimeBridge();
    const handlers = createRunsIpcHandlers({
      assertWorkspaceExists: () => undefined,
      resolveWorkspaceRootDir: () => '/tmp/runtime-launch-workspace',
      runtimeBridge,
      prepareRuntimeLaunch: (input) => {
        preflightCalls.push(input.runtime);
      }
    });

    const firstRun = await handlers.startRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-runtime-switch',
      nodeId: 'terminal-1',
      runtime: 'opencode',
      command: 'run --help'
    });
    const secondRun = await handlers.startRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-runtime-switch',
      nodeId: 'terminal-2',
      runtime: 'claude',
      command: 'run --help'
    });

    expect(firstRun.run.status).toBe('queued');
    expect(secondRun.run.status).toBe('failed');
    expect(secondRun.run.summary).toContain('Managed runtime launch blocked');
    expect(secondRun.run.tailLog).toContain('Managed runtime launch blocked');
    expect(preflightCalls).toEqual(['opencode']);
    expect(runtimeBridge.startRequests).toHaveLength(1);
    expect(runtimeBridge.startRequests[0]?.runtime).toBe('opencode');
  });

  it('keeps managed-runtime exclusivity during the stop grace window until exit finalizes', async () => {
    const preflightCalls: string[] = [];
    const runtimeBridge = new HoldRuntimeBridge();
    const handlers = createRunsIpcHandlers({
      assertWorkspaceExists: () => undefined,
      resolveWorkspaceRootDir: () => '/tmp/runtime-launch-workspace',
      runtimeBridge,
      prepareRuntimeLaunch: (input) => {
        preflightCalls.push(input.runtime);
      }
    });

    const firstRun = await handlers.startRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-runtime-stop-window',
      nodeId: 'terminal-1',
      runtime: 'opencode',
      command: 'run --help'
    });
    runtimeBridge.emit('started', {
      runId: firstRun.run.id,
      pid: 4242
    });

    const stopResult = await handlers.stopRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-runtime-stop-window',
      runId: firstRun.run.id
    });
    expect(stopResult.run.status).toBe('running');

    const blockedRun = await handlers.startRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-runtime-stop-window',
      nodeId: 'terminal-2',
      runtime: 'claude',
      command: 'run --help'
    });
    expect(blockedRun.run.status).toBe('failed');
    expect(blockedRun.run.summary).toContain('Managed runtime launch blocked');

    runtimeBridge.emit('exit', {
      runId: firstRun.run.id,
      code: 130,
      signal: null,
      tail: 'stopped\n'
    });

    const nextRun = await handlers.startRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-runtime-stop-window',
      nodeId: 'terminal-3',
      runtime: 'claude',
      command: 'run --help'
    });
    expect(nextRun.run.status).toBe('queued');
    expect(preflightCalls).toEqual(['opencode', 'claude']);
    expect(runtimeBridge.startRequests).toHaveLength(2);
    expect(runtimeBridge.startRequests[1]?.runtime).toBe('claude');
  });


  it('keeps PTY worker control inside the bridge worker boundary and preserves SystemRoot', async () => {
    const postedMessages: unknown[] = [];
    const kill = vi.fn();
    const originalSystemRoot = process.env.SystemRoot;
    process.env.SystemRoot = 'C:\\Windows';

    try {
      let capturedEnv: NodeJS.ProcessEnv | null = null;
      const bridge = createRuntimeBridge({
        spawnWorker: (_request, env) => {
          capturedEnv = env;
          return {
            postMessage: (message) => {
              postedMessages.push(message);
            },
            onMessage: () => undefined,
            onExit: () => undefined,
            kill
          };
        }
      });

      bridge.start({
        runId: 'run-worker-boundary',
        runtime: 'shell',
        command: 'echo hello',
        cwd: '/tmp/runtime-launch-workspace',
        env: {
          OPENWEAVE_FLAG: '1'
        }
      });

      expect(capturedEnv).toMatchObject({
        OPENWEAVE_FLAG: '1',
        SystemRoot: 'C:\\Windows'
      });
      expect(postedMessages[0]).toMatchObject({
        type: 'start',
        runId: 'run-worker-boundary',
        runtime: 'shell',
        command: 'echo hello',
        cwd: '/tmp/runtime-launch-workspace'
      });

      expect(bridge.input('run-worker-boundary', 'status\n')).toBe(true);
      expect(bridge.stop('run-worker-boundary')).toBe(true);
      expect(bridge.input('missing-run', 'status\n')).toBe(false);
      expect(bridge.stop('missing-run')).toBe(false);
      expect(postedMessages.slice(1)).toEqual([
        {
          type: 'input',
          runId: 'run-worker-boundary',
          input: 'status\n'
        },
        {
          type: 'stop',
          runId: 'run-worker-boundary'
        }
      ]);
      expect(kill).not.toHaveBeenCalled();

      bridge.dispose();
      expect(kill).toHaveBeenCalledTimes(1);
    } finally {
      process.env.SystemRoot = originalSystemRoot;
    }
  });

  it('preserves coded runtime worker errors in failed run summaries and tails', async () => {
    const runtimeBridge: RuntimeBridge = {
      on: () => runtimeBridge,
      off: () => runtimeBridge,
      start: () => {
        throw new RuntimeWorkerError(
          'RUNTIME_UNSUPPORTED',
          'Unsupported runtime: invalid-runtime'
        );
      },
      stop: () => false,
      dispose: () => undefined
    };

    const handlers = createRunsIpcHandlers({
      assertWorkspaceExists: () => undefined,
      runtimeBridge
    });

    const result = await handlers.startRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-runtime-error-code',
      nodeId: 'terminal-1',
      runtime: 'shell',
      command: 'echo hello'
    });

    expect(result.run.status).toBe('failed');
    expect(result.run.summary).toBe('[RUNTIME_UNSUPPORTED] Unsupported runtime: invalid-runtime');
    expect(result.run.tailLog).toContain('[RUNTIME_UNSUPPORTED] Unsupported runtime: invalid-runtime');
  });

  it('cleans managed workspace files when the workspace runs are disposed', async () => {
    const testDir = mkdtemp('openweave-runtime-dispose-');
    const dbFilePath = path.join(testDir, 'registry.sqlite');
    const workspaceDbDir = path.join(testDir, 'workspaces');
    const workspaceRoot = path.join(testDir, 'workspace-root');
    fs.mkdirSync(workspaceDbDir, { recursive: true });
    fs.mkdirSync(workspaceRoot, { recursive: true });

    const registry = createRegistryRepository({ dbFilePath });
    const workspace = registry.createWorkspace({
      name: 'Dispose Workspace',
      rootDir: workspaceRoot
    });
    registry.close();

    const ipcMain = new IpcMainStub();
    const runtimeBridge = new HoldRuntimeBridge();
    registerRunsIpcHandlers({
      dbFilePath,
      workspaceDbDir,
      ipcMain,
      runtimeBridge
    });

    await ipcMain.invoke(IPC_CHANNELS.runStart, {
      workspaceId: workspace.id,
      nodeId: 'terminal-1',
      runtime: 'opencode',
      command: 'run --help'
    });

    expect(fs.existsSync(path.join(workspaceRoot, 'AGENTS.md'))).toBe(true);
    expect(fs.existsSync(path.join(workspaceRoot, '.opencode', 'skills', 'openweave-workspace.md'))).toBe(true);

    disposeRunsForWorkspace(workspace.id);

    expect(fs.existsSync(path.join(workspaceRoot, 'AGENTS.md'))).toBe(false);
    expect(fs.existsSync(path.join(workspaceRoot, '.opencode', 'skills', 'openweave-workspace.md'))).toBe(false);
  });
});
