import { EventEmitter } from 'node:events';
import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it } from 'vitest';
import { createRunsIpcHandlers, type RunsIpcHandlers } from '../../../src/main/ipc/runs';
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

class HoldRuntimeBridge extends EventEmitter implements RuntimeBridge {
  public readonly stopCalls: string[] = [];

  public start(_request: RuntimeStartRequest): void {}

  public stop(runId: string): boolean {
    this.stopCalls.push(runId);
    return true;
  }

  public dispose(): void {
    this.removeAllListeners();
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

  it('cleans workspace runs and stops active workers on workspace deletion', async () => {
    const runtimeBridge = new HoldRuntimeBridge();
    const handlers: RunsIpcHandlers = createRunsIpcHandlers({
      runtimeBridge,
      assertWorkspaceExists: assertWorkspaceExists(['ws-1'])
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
});
