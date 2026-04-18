import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
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
import type { RuntimeBridge, RuntimeStartRequest } from '../../../src/main/runtime/runtime-bridge';

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
