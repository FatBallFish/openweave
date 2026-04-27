import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it } from 'vitest';
import { IPC_CHANNELS } from '../../../src/shared/ipc/contracts';
import { runStatusSchema } from '../../../src/shared/ipc/schemas';
import { createRegistryRepository } from '../../../src/main/db/registry';
import { createWorkspaceRepository } from '../../../src/main/db/workspace';
import { createLocalWorkspaceNodeQueryService } from '../../../src/main/bridge/workspace-node-query-service';
import {
  createRunsIpcHandlers,
  disposeRunsIpcHandlers,
  registerRunsIpcHandlers,
  type RunsIpcHandlers
} from '../../../src/main/ipc/runs';
import type {
  RuntimeBridge,
  RuntimeExitEvent,
  RuntimeStartRequest,
  RuntimeStreamEvent
} from '../../../src/main/runtime/runtime-bridge';

const waitFor = async (
  predicate: () => Promise<boolean>,
  timeoutMs: number,
  intervalMs: number
): Promise<void> => {
  const startedAt = Date.now();
  while (!(await predicate())) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out after ${timeoutMs}ms`);
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, intervalMs);
    });
  }
};

const assertWorkspaceExists = (workspaceIds: string[]) => {
  const allowed = new Set(workspaceIds);
  return (workspaceId: string): void => {
    if (!allowed.has(workspaceId)) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }
  };
};

class CompletingRuntimeBridge extends EventEmitter implements RuntimeBridge {
  public start(request: RuntimeStartRequest): void {
    setTimeout(() => {
      this.emit('started', { runId: request.runId, pid: 4242 });
      this.emit('stdout', {
        runId: request.runId,
        chunk: 'hello\n'
      } satisfies RuntimeStreamEvent);
      this.emit('exit', {
        runId: request.runId,
        code: 0,
        signal: null,
        tail: 'hello\n'
      } satisfies RuntimeExitEvent);
    }, 20);
  }

  public stop(_runId: string): boolean {
    return true;
  }

  public dispose(): void {
    this.removeAllListeners();
  }
}

class FailingRuntimeBridge extends EventEmitter implements RuntimeBridge {
  public start(_request: RuntimeStartRequest): void {
    throw new Error('worker launch failed');
  }

  public stop(_runId: string): boolean {
    return false;
  }

  public dispose(): void {
    this.removeAllListeners();
  }
}

class FallbackExitRuntimeBridge extends EventEmitter implements RuntimeBridge {
  public start(request: RuntimeStartRequest): void {
    setTimeout(() => {
      this.emit('started', { runId: request.runId, pid: 4242 });
      this.emit('stdout', {
        runId: request.runId,
        chunk: 'partial output\n'
      } satisfies RuntimeStreamEvent);
      this.emit('exit', {
        runId: request.runId,
        code: 1,
        signal: null,
        tail: ''
      } satisfies RuntimeExitEvent);
    }, 20);
  }

  public stop(_runId: string): boolean {
    return true;
  }

  public dispose(): void {
    this.removeAllListeners();
  }
}

class HoldRuntimeBridge extends EventEmitter implements RuntimeBridge {
  public readonly stopCalls: string[] = [];
  public readonly startRequests: RuntimeStartRequest[] = [];
  public readonly inputCalls: Array<{ runId: string; input: string }> = [];

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
    this.removeAllListeners();
  }
}

class IpcMainStub {
  public readonly handlers = new Map<string, (...args: any[]) => unknown>();
  public readonly listeners = new Map<string, Set<(...args: any[]) => void>>();

  public handle(channel: string, listener: (...args: any[]) => unknown): void {
    this.handlers.set(channel, listener);
  }

  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  public on(channel: string, listener: (...args: any[]) => void): void {
    const set = this.listeners.get(channel) ?? new Set();
    set.add(listener);
    this.listeners.set(channel, set);
  }

  public async invoke(channel: string, payload: unknown): Promise<unknown> {
    const handler = this.handlers.get(channel);
    if (!handler) {
      throw new Error(`IPC handler not registered: ${channel}`);
    }
    return handler({} as IpcMainInvokeEvent, payload);
  }
}

describe('runs IPC flow', () => {
  it('accepts stopped as a first-class run status', () => {
    expect(runStatusSchema.parse('stopped')).toBe('stopped');
  });

  it('transitions a run from queued to completed and stores the summary', async () => {
    const handlers: RunsIpcHandlers = createRunsIpcHandlers({
      runtimeBridge: new CompletingRuntimeBridge(),
      assertWorkspaceExists: assertWorkspaceExists(['ws-1'])
    });

    const started = await handlers.startRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      nodeId: 'term-1',
      runtime: 'shell',
      command: 'echo hello'
    });
    expect(started.run.status).toBe('queued');

    await waitFor(async () => {
      const current = await handlers.getRun({} as IpcMainInvokeEvent, {
        workspaceId: 'ws-1',
        runId: started.run.id
      });
      return current.run.status === 'completed';
    }, 3000, 50);

    const stored = await handlers.getRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      runId: started.run.id
    });
    expect(stored.run.status).toBe('completed');
    expect(stored.run.summary).toContain('hello');
    expect(stored.run.tailLog).toBe('hello\n');
  });

  it('marks run as failed when runtime bridge throws on start', async () => {
    const handlers: RunsIpcHandlers = createRunsIpcHandlers({
      runtimeBridge: new FailingRuntimeBridge(),
      assertWorkspaceExists: assertWorkspaceExists(['ws-1'])
    });

    const started = await handlers.startRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      nodeId: 'term-1',
      runtime: 'shell',
      command: 'echo hello'
    });

    expect(started.run.status).toBe('failed');
    expect(started.run.summary).toContain('worker launch failed');
    expect(started.run.completedAtMs).toBeTypeOf('number');

    const listed = await handlers.listRuns({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      nodeId: 'term-1'
    });
    expect(listed.runs).toHaveLength(1);
    expect(listed.runs[0].status).toBe('failed');
  });

  it('preserves streamed tail output when exit fallback provides an empty tail', async () => {
    const handlers: RunsIpcHandlers = createRunsIpcHandlers({
      runtimeBridge: new FallbackExitRuntimeBridge(),
      assertWorkspaceExists: assertWorkspaceExists(['ws-1'])
    });

    const started = await handlers.startRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      nodeId: 'term-1',
      runtime: 'shell',
      command: 'echo hello'
    });

    await waitFor(async () => {
      const current = await handlers.getRun({} as IpcMainInvokeEvent, {
        workspaceId: 'ws-1',
        runId: started.run.id
      });
      return current.run.status === 'failed';
    }, 3000, 50);

    const stored = await handlers.getRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      runId: started.run.id
    });
    expect(stored.run.tailLog).toBe('partial output\n');
    expect(stored.run.summary).toContain('partial output');
  });

  it('waits for confirmed exit before finalizing stopped and keeps late tail output', async () => {
    const runtimeBridge = new HoldRuntimeBridge();
    const handlers: RunsIpcHandlers = createRunsIpcHandlers({
      runtimeBridge,
      assertWorkspaceExists: assertWorkspaceExists(['ws-1'])
    });

    const started = await handlers.startRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      nodeId: 'term-1',
      runtime: 'shell',
      command: 'cat'
    });

    runtimeBridge.emit('started', {
      runId: started.run.id,
      pid: 4242
    });

    const stopping = await handlers.stopRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      runId: started.run.id
    });
    expect(stopping.run.status).toBe('running');
    expect(runtimeBridge.stopCalls).toEqual([started.run.id]);

    runtimeBridge.emit('stdout', {
      runId: started.run.id,
      chunk: 'shutdown tail\n'
    } satisfies RuntimeStreamEvent);

    const beforeExit = await handlers.getRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      runId: started.run.id
    });
    expect(beforeExit.run.status).toBe('running');
    expect(beforeExit.run.tailLog).toContain('shutdown tail');

    runtimeBridge.emit('exit', {
      runId: started.run.id,
      code: 130,
      signal: null,
      tail: 'shutdown tail\n'
    } satisfies RuntimeExitEvent);

    const finalized = await handlers.getRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      runId: started.run.id
    });
    expect(finalized.run.status).toBe('stopped');
    expect(finalized.run.summary).toBe('Run stopped');
    expect(finalized.run.tailLog).toContain('shutdown tail');
    expect(finalized.run.completedAtMs).toBeTypeOf('number');
  });

  it('cleans workspace runs and stops active workers on workspace deletion', async () => {
    const runtimeBridge = new HoldRuntimeBridge();
    const handlers: RunsIpcHandlers = createRunsIpcHandlers({
      runtimeBridge,
      assertWorkspaceExists: assertWorkspaceExists(['ws-1']),
      resolveWorkspaceRootDir: () => '/tmp/ws-1'
    });

    const started = await handlers.startRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      nodeId: 'term-1',
      runtime: 'shell',
      command: 'echo hello'
    });

    handlers.disposeWorkspaceRuns('ws-1');
    expect(runtimeBridge.stopCalls).toEqual([started.run.id]);

    const listed = await handlers.listRuns({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      nodeId: 'term-1'
    });
    expect(listed.runs).toEqual([]);
  });

  it('passes workspace root as cwd when starting runs via createRunsIpcHandlers', async () => {
    const runtimeBridge = new HoldRuntimeBridge();
    const handlers: RunsIpcHandlers = createRunsIpcHandlers({
      runtimeBridge,
      assertWorkspaceExists: assertWorkspaceExists(['ws-1']),
      resolveWorkspaceRootDir: (workspaceId: string) => `/tmp/${workspaceId}`
    });

    await handlers.startRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      nodeId: 'term-1',
      runtime: 'shell',
      command: 'pwd'
    });

    expect(runtimeBridge.startRequests).toHaveLength(1);
    expect(runtimeBridge.startRequests[0].cwd).toBe('/tmp/ws-1');
  });

  it('prevents cross-workspace run:get leakage', async () => {
    const handlers: RunsIpcHandlers = createRunsIpcHandlers({
      runtimeBridge: new CompletingRuntimeBridge(),
      assertWorkspaceExists: assertWorkspaceExists(['ws-1', 'ws-2'])
    });

    const started = await handlers.startRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      nodeId: 'term-1',
      runtime: 'shell',
      command: 'echo hello'
    });

    await expect(
      handlers.getRun({} as IpcMainInvokeEvent, {
        workspaceId: 'ws-2',
        runId: started.run.id
      })
    ).rejects.toThrow(`Run not found: ${started.run.id}`);
  });

  it('routes interactive input and stop commands through the run handlers', async () => {
    const runtimeBridge = new HoldRuntimeBridge();
    const handlers: RunsIpcHandlers = createRunsIpcHandlers({
      runtimeBridge,
      assertWorkspaceExists: assertWorkspaceExists(['ws-1'])
    });

    const started = await handlers.startRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      nodeId: 'term-1',
      runtime: 'shell',
      command: 'cat'
    });

    runtimeBridge.emit('started', { runId: started.run.id, pid: 4242 });

    const inputResult = await handlers.inputRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      runId: started.run.id,
      input: 'status\n'
    });
    expect(inputResult).toEqual({ ok: true });
    expect(runtimeBridge.inputCalls).toEqual([{ runId: started.run.id, input: 'status\n' }]);

    const stopped = await handlers.stopRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      runId: started.run.id
    });
    expect(stopped.run.status).toBe('running');
    expect(runtimeBridge.stopCalls).toEqual([started.run.id]);

    await expect(
      handlers.inputRun({} as IpcMainInvokeEvent, {
        workspaceId: 'ws-1',
        runId: started.run.id,
        input: 'after-stop\n'
      })
    ).rejects.toThrow(`Run not accepting input: ${started.run.id}`);

    runtimeBridge.emit('exit', {
      runId: started.run.id,
      code: 130,
      signal: null,
      tail: ''
    } satisfies RuntimeExitEvent);

    const stored = await handlers.getRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      runId: started.run.id
    });
    expect(stored.run.status).toBe('stopped');
    expect(stored.run.summary).toBe('Run stopped');
  });

  it('passes workspace root as cwd when starting runs via registered IPC handlers', async () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-runs-ipc-'));
    const dbFilePath = path.join(testDir, 'registry.sqlite');
    const workspaceDbDir = path.join(testDir, 'workspaces');
    const workspaceRoot = fs.mkdtempSync(path.join(testDir, 'workspace-root-'));
    const runtimeBridge = new HoldRuntimeBridge();
    const ipcMain = new IpcMainStub();

    try {
      const registry = createRegistryRepository({ dbFilePath });
      const workspace = registry.createWorkspace({
        name: 'Run Workspace',
        rootDir: workspaceRoot
      });
      registry.close();

      registerRunsIpcHandlers({
        dbFilePath,
        workspaceDbDir,
        ipcMain,
        runtimeBridge,
        launchEnv: {
          OPENWEAVE_CLI: '/tmp/openweave/bin/openweave'
        }
      });

      await ipcMain.invoke(IPC_CHANNELS.runStart, {
        workspaceId: workspace.id,
        nodeId: 'term-1',
        runtime: 'shell',
        command: 'pwd'
      });

      expect(runtimeBridge.startRequests).toHaveLength(1);
      expect(runtimeBridge.startRequests[0].cwd).toBe(fs.realpathSync(workspaceRoot));
      expect(runtimeBridge.startRequests[0].env).toMatchObject({
        OPENWEAVE_WORKSPACE_ID: workspace.id,
        OPENWEAVE_NODE_ID: 'term-1',
        OPENWEAVE_TERMINAL_NODE_ID: 'term-1',
        OPENWEAVE_WORKSPACE_ROOT: fs.realpathSync(workspaceRoot),
        OPENWEAVE_TERMINAL_WORKING_DIR: fs.realpathSync(workspaceRoot),
        OPENWEAVE_CLI: '/tmp/openweave/bin/openweave'
      });
    } finally {
      disposeRunsIpcHandlers();
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('delivers queued terminal dispatches into the active terminal run', async () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-runs-dispatch-'));
    const dbFilePath = path.join(testDir, 'registry.sqlite');
    const workspaceDbDir = path.join(testDir, 'workspaces');
    const workspaceRoot = fs.mkdtempSync(path.join(testDir, 'workspace-root-'));
    const runtimeBridge = new HoldRuntimeBridge();
    const ipcMain = new IpcMainStub();

    try {
      const registry = createRegistryRepository({ dbFilePath });
      const workspace = registry.createWorkspace({
        name: 'Run Dispatch Workspace',
        rootDir: workspaceRoot
      });
      registry.close();

      const workspaceRepository = createWorkspaceRepository({
        dbFilePath: path.join(workspaceDbDir, `${workspace.id}.db`)
      });
      workspaceRepository.saveGraphSnapshot({
        schemaVersion: 2,
        nodes: [
          {
            id: 'term-1',
            componentType: 'builtin.terminal',
            componentVersion: '1.0.0',
            title: 'Terminal',
            bounds: {
              x: 0,
              y: 0,
              width: 320,
              height: 240
            },
            config: {
              runtime: 'shell'
            },
            state: {
              activeSessionId: null
            },
            capabilities: ['read', 'write', 'execute', 'stream'],
            createdAtMs: 1,
            updatedAtMs: 2
          }
        ],
        edges: []
      });
      workspaceRepository.close();

      registerRunsIpcHandlers({
        dbFilePath,
        workspaceDbDir,
        ipcMain,
        runtimeBridge,
        launchEnv: {
          OPENWEAVE_CLI: '/tmp/openweave/bin/openweave'
        }
      });

      const started = (await ipcMain.invoke(IPC_CHANNELS.runStart, {
        workspaceId: workspace.id,
        nodeId: 'term-1',
        runtime: 'shell',
        command: 'cat'
      })) as {
        run: { id: string };
      };

      runtimeBridge.emit('started', {
        runId: started.run.id,
        pid: 4242
      });

      const workspaceNodeService = createLocalWorkspaceNodeQueryService({
        registryDbFilePath: dbFilePath,
        workspaceDbDir
      });
      try {
        expect(
          workspaceNodeService.runNodeAction({
            workspaceId: workspace.id,
            nodeId: 'term-1',
            action: 'send',
            payload: {
              input: 'status\\n'
            }
          })
        ).toEqual({
          nodeId: 'term-1',
          action: 'send',
          ok: true,
          result: expect.objectContaining({
            queued: true
          })
        });
      } finally {
        workspaceNodeService.close();
      }

      await waitFor(async () => runtimeBridge.inputCalls.length === 1, 3000, 50);
      expect(runtimeBridge.inputCalls).toEqual([{ runId: started.run.id, input: 'status\\n' }]);
    } finally {
      disposeRunsIpcHandlers();
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('delivers terminal submit requests as PTY enter keypresses', async () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-runs-submit-'));
    const dbFilePath = path.join(testDir, 'registry.sqlite');
    const workspaceDbDir = path.join(testDir, 'workspaces');
    const workspaceRoot = fs.mkdtempSync(path.join(testDir, 'workspace-root-'));
    const runtimeBridge = new HoldRuntimeBridge();
    const ipcMain = new IpcMainStub();

    try {
      const registry = createRegistryRepository({ dbFilePath });
      const workspace = registry.createWorkspace({
        name: 'Run Submit Workspace',
        rootDir: workspaceRoot
      });
      registry.close();

      const workspaceRepository = createWorkspaceRepository({
        dbFilePath: path.join(workspaceDbDir, `${workspace.id}.db`)
      });
      workspaceRepository.saveGraphSnapshot({
        schemaVersion: 2,
        nodes: [
          {
            id: 'term-1',
            componentType: 'builtin.terminal',
            componentVersion: '1.0.0',
            title: 'Terminal',
            bounds: {
              x: 0,
              y: 0,
              width: 320,
              height: 240
            },
            config: {
              runtime: 'shell'
            },
            state: {
              activeSessionId: null
            },
            capabilities: ['read', 'write', 'execute', 'stream'],
            createdAtMs: 1,
            updatedAtMs: 2
          }
        ],
        edges: []
      });
      workspaceRepository.close();

      registerRunsIpcHandlers({
        dbFilePath,
        workspaceDbDir,
        ipcMain,
        runtimeBridge,
        launchEnv: {
          OPENWEAVE_CLI: '/tmp/openweave/bin/openweave'
        }
      });

      const started = (await ipcMain.invoke(IPC_CHANNELS.runStart, {
        workspaceId: workspace.id,
        nodeId: 'term-1',
        runtime: 'shell',
        command: 'cat'
      })) as {
        run: { id: string };
      };

      runtimeBridge.emit('started', {
        runId: started.run.id,
        pid: 4242
      });

      const workspaceNodeService = createLocalWorkspaceNodeQueryService({
        registryDbFilePath: dbFilePath,
        workspaceDbDir
      });
      try {
        expect(
          workspaceNodeService.runNodeAction({
            workspaceId: workspace.id,
            nodeId: 'term-1',
            action: 'send',
            payload: {
              input: 'status\n',
              submit: true
            }
          })
        ).toEqual({
          nodeId: 'term-1',
          action: 'send',
          ok: true,
          result: {
            queued: true,
            input: 'status\r',
            submitted: true
          }
        });
      } finally {
        workspaceNodeService.close();
      }

      await waitFor(async () => runtimeBridge.inputCalls.length === 1, 3000, 50);
      expect(runtimeBridge.inputCalls).toEqual([{ runId: started.run.id, input: 'status\r' }]);
    } finally {
      disposeRunsIpcHandlers();
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
});
