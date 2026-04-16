import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it } from 'vitest';
import { IPC_CHANNELS } from '../../../src/shared/ipc/contracts';
import { createRegistryRepository } from '../../../src/main/db/registry';
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

  public start(request: RuntimeStartRequest): void {
    this.startRequests.push(request);
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

  public handle(channel: string, listener: (...args: any[]) => unknown): void {
    this.handlers.set(channel, listener);
  }

  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
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
        runtimeBridge
      });

      await ipcMain.invoke(IPC_CHANNELS.runStart, {
        workspaceId: workspace.id,
        nodeId: 'term-1',
        runtime: 'shell',
        command: 'pwd'
      });

      expect(runtimeBridge.startRequests).toHaveLength(1);
      expect(runtimeBridge.startRequests[0].cwd).toBe(fs.realpathSync(workspaceRoot));
    } finally {
      disposeRunsIpcHandlers();
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
});
