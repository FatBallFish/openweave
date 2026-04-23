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
  public readonly listeners = new Map<string, Set<(...args: any[]) => void>>();

  public handle(channel: string, listener: (...args: any[]) => unknown): void {
    this.handlers.set(channel, listener);
  }

  public removeHandler(channel: string): void {
    this.removed.push(channel);
    this.handlers.delete(channel);
  }

  public on(channel: string, listener: (...args: any[]) => void): void {
    const set = this.listeners.get(channel) ?? new Set();
    set.add(listener);
    this.listeners.set(channel, set);
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
  public readonly inputCalls: Array<{ runId: string; input: string }> = [];
  public disposed = false;

  public start(request: RuntimeStartRequest): void {
    this.startRequests.push(request);
  }

  public input(runId: string, input: string): boolean {
    this.inputCalls.push({ runId, input });
    return true;
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
      IPC_CHANNELS.runList,
      IPC_CHANNELS.runInput,
      IPC_CHANNELS.runStop,
      IPC_CHANNELS.runStreamSubscribe,
      IPC_CHANNELS.runStreamUnsubscribe,
      IPC_CHANNELS.runResize
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

  it('persists user-stopped runs as stopped and does not recover them as failed', async () => {
    const bridge = new HoldRuntimeBridge();
    const { workspace, workspaceDbDir, ipcMain } = setupRegisteredRuns(bridge, {
      enableCrashRecoveryOnOpen: true
    });

    const started = await ipcMain.invoke(IPC_CHANNELS.runStart, {
      workspaceId: workspace.id,
      nodeId: 'terminal-1',
      runtime: 'shell',
      command: 'cat'
    });

    const stopped = await ipcMain.invoke(IPC_CHANNELS.runStop, {
      workspaceId: workspace.id,
      runId: started.run.id
    });
    expect(stopped.run.status).toBe('queued');
    expect(bridge.stopCalls).toEqual([started.run.id]);

    bridge.emit('exit', {
      runId: started.run.id,
      code: 130,
      signal: null,
      tail: 'stopped\n'
    });

    recoverRunsForWorkspace(workspace.id);

    const repository = createWorkspaceRepository({
      dbFilePath: path.join(workspaceDbDir, `${workspace.id}.db`)
    });
    expect(repository.getRun(started.run.id)?.status).toBe('stopped');
    expect(repository.listAuditLogs().filter((audit) => audit.eventType === 'run.recovered')).toEqual([]);
    repository.close();
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

  it('reconciles orphaned active runs from persistence before listing or stopping them', async () => {
    const bridge = new HoldRuntimeBridge();
    const { workspace, workspaceDbDir, ipcMain } = setupRegisteredRuns(bridge, {
      enableCrashRecoveryOnOpen: false
    });

    let repository = createWorkspaceRepository({
      dbFilePath: path.join(workspaceDbDir, `${workspace.id}.db`)
    });
    repository.saveRun({
      id: 'run-orphaned',
      workspaceId: workspace.id,
      nodeId: 'terminal-1',
      runtime: 'shell',
      command: 'echo orphaned',
      status: 'running',
      summary: null,
      tailLog: 'orphaned\n',
      createdAtMs: 1,
      startedAtMs: 2,
      completedAtMs: null
    });
    repository.close();

    const listed = await ipcMain.invoke(IPC_CHANNELS.runList, {
      workspaceId: workspace.id,
      nodeId: 'terminal-1'
    });
    expect(listed.runs).toHaveLength(1);
    expect(listed.runs[0]?.status).toBe('failed');
    expect(listed.runs[0]?.summary).toBe('Recovered after unclean shutdown');

    const stopped = await ipcMain.invoke(IPC_CHANNELS.runStop, {
      workspaceId: workspace.id,
      runId: 'run-orphaned'
    });
    expect(stopped.run.status).toBe('failed');
    expect(bridge.stopCalls).toEqual([]);

    repository = createWorkspaceRepository({
      dbFilePath: path.join(workspaceDbDir, `${workspace.id}.db`)
    });
    expect(repository.getRun('run-orphaned')?.status).toBe('failed');
    expect(repository.listAuditLogs().filter((audit) => audit.eventType === 'run.recovered')).toHaveLength(1);
    repository.close();
  });
});
