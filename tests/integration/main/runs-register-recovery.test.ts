import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { IPC_CHANNELS } from '../../../src/shared/ipc/contracts';
import { createRegistryRepository } from '../../../src/main/db/registry';
import { createWorkspaceRepository } from '../../../src/main/db/workspace';
import {
  disposeRunsForWorkspace,
  disposeRunsIpcHandlers,
  recoverRunsForWorkspace,
  registerRunsIpcHandlers,
  type RegisterRunsIpcHandlersOptions
} from '../../../src/main/ipc/runs';
import type { RuntimeBridge, RuntimeStartRequest } from '../../../src/main/runtime/runtime-bridge';

class IpcMainStub {
  public readonly handlers = new Map<string, (...args: any[]) => unknown>();
  public readonly removed: string[] = [];

  public handle(channel: string, listener: (...args: any[]) => unknown): void {
    this.handlers.set(channel, listener);
  }

  public removeHandler(channel: string): void {
    this.removed.push(channel);
    this.handlers.delete(channel);
  }

  public async invoke(channel: string, payload: unknown): Promise<any> {
    const handler = this.handlers.get(channel);
    if (!handler) {
      throw new Error(`IPC handler not registered: ${channel}`);
    }
    return handler({}, payload);
  }
}

class HoldRuntimeBridge extends EventEmitter implements RuntimeBridge {
  public readonly startRequests: RuntimeStartRequest[] = [];
  public readonly stopCalls: string[] = [];
  public disposed = false;

  public start(request: RuntimeStartRequest): void {
    this.startRequests.push(request);
  }

  public stop(runId: string): boolean {
    this.stopCalls.push(runId);
    return true;
  }

  public dispose(): void {
    this.disposed = true;
    this.removeAllListeners();
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

const setupRegisteredRuns = (
  bridge: HoldRuntimeBridge,
  extraOptions: Partial<RegisterRunsIpcHandlersOptions> = {}
) => {
  const testDir = mkdtemp('openweave-runs-registered-');
  const dbFilePath = path.join(testDir, 'registry.sqlite');
  const workspaceDbDir = path.join(testDir, 'workspaces');
  fs.mkdirSync(workspaceDbDir, { recursive: true });
  const registry = createRegistryRepository({ dbFilePath });
  const workspaceRoot = path.join(testDir, 'workspace-root');
  fs.mkdirSync(workspaceRoot, { recursive: true });
  const workspace = registry.createWorkspace({
    name: 'Workspace',
    rootDir: workspaceRoot
  });
  registry.close();

  const ipcMain = new IpcMainStub();
  registerRunsIpcHandlers({
    dbFilePath,
    workspaceDbDir,
    ipcMain,
    runtimeBridge: bridge,
    ...extraOptions
  });

  return { testDir, dbFilePath, workspaceDbDir, workspace, ipcMain };
};

describe('registered runs IPC handlers', () => {
  it('registers handlers and disposes active workspace runs plus persisted data', async () => {
    const bridge = new HoldRuntimeBridge();
    const { workspace, workspaceDbDir, ipcMain } = setupRegisteredRuns(bridge);

    expect(ipcMain.removed).toEqual([
      IPC_CHANNELS.runStart,
      IPC_CHANNELS.runGet,
      IPC_CHANNELS.runList
    ]);

    const started = await ipcMain.invoke(IPC_CHANNELS.runStart, {
      workspaceId: workspace.id,
      nodeId: 'terminal-1',
      runtime: 'shell',
      command: 'pwd'
    });
    expect(bridge.startRequests[0].cwd).toBe(fs.realpathSync(workspace.rootDir));

    const repository = createWorkspaceRepository({
      dbFilePath: path.join(workspaceDbDir, `${workspace.id}.db`)
    });
    repository.appendAuditLog({
      id: 'audit-1',
      workspaceId: workspace.id,
      eventType: 'run.started',
      runId: started.run.id,
      status: 'success',
      message: 'started',
      createdAtMs: 1
    });
    repository.close();

    disposeRunsForWorkspace(workspace.id);
    expect(bridge.stopCalls).toEqual([started.run.id]);

    const reloadedRepository = createWorkspaceRepository({
      dbFilePath: path.join(workspaceDbDir, `${workspace.id}.db`)
    });
    expect(reloadedRepository.listRuns()).toEqual([]);
    expect(reloadedRepository.listAuditLogs()).toEqual([]);
    reloadedRepository.close();
  });

  it('recovers persisted runs once when crash recovery is enabled and skips recovery when disabled', () => {
    const disabledBridge = new HoldRuntimeBridge();
    const disabledSetup = setupRegisteredRuns(disabledBridge, {
      enableCrashRecoveryOnOpen: false
    });
    let repository = createWorkspaceRepository({
      dbFilePath: path.join(disabledSetup.workspaceDbDir, `${disabledSetup.workspace.id}.db`)
    });
    repository.saveRun({
      id: 'run-disabled',
      workspaceId: disabledSetup.workspace.id,
      nodeId: 'terminal-1',
      runtime: 'shell',
      command: 'echo disabled',
      status: 'running',
      summary: null,
      tailLog: 'disabled\n',
      createdAtMs: 1,
      startedAtMs: 2,
      completedAtMs: null
    });
    repository.close();

    recoverRunsForWorkspace(disabledSetup.workspace.id);

    repository = createWorkspaceRepository({
      dbFilePath: path.join(disabledSetup.workspaceDbDir, `${disabledSetup.workspace.id}.db`)
    });
    expect(repository.getRun('run-disabled')?.status).toBe('running');
    repository.close();
    disposeRunsIpcHandlers();

    const enabledBridge = new HoldRuntimeBridge();
    const enabledSetup = setupRegisteredRuns(enabledBridge, {
      enableCrashRecoveryOnOpen: true
    });
    repository = createWorkspaceRepository({
      dbFilePath: path.join(enabledSetup.workspaceDbDir, `${enabledSetup.workspace.id}.db`)
    });
    repository.saveRun({
      id: 'run-enabled',
      workspaceId: enabledSetup.workspace.id,
      nodeId: 'terminal-1',
      runtime: 'shell',
      command: 'echo enabled',
      status: 'queued',
      summary: null,
      tailLog: 'enabled\n',
      createdAtMs: 1,
      startedAtMs: null,
      completedAtMs: null
    });
    repository.close();

    recoverRunsForWorkspace(enabledSetup.workspace.id);
    recoverRunsForWorkspace(enabledSetup.workspace.id);

    repository = createWorkspaceRepository({
      dbFilePath: path.join(enabledSetup.workspaceDbDir, `${enabledSetup.workspace.id}.db`)
    });
    expect(repository.getRun('run-enabled')?.status).toBe('failed');
    expect(repository.listAuditLogs().filter((audit) => audit.eventType === 'run.recovered')).toHaveLength(1);
    repository.close();
  });
});
