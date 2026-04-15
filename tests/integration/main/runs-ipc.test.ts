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

class MockRuntimeBridge extends EventEmitter implements RuntimeBridge {
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

  public dispose(): void {
    this.removeAllListeners();
  }
}

describe('runs IPC flow', () => {
  it('transitions a run from queued to completed and stores the summary', async () => {
    const handlers: RunsIpcHandlers = createRunsIpcHandlers({
      runtimeBridge: new MockRuntimeBridge(),
      assertWorkspaceExists: (workspaceId: string): void => {
        if (workspaceId !== 'ws-1') {
          throw new Error(`Workspace not found: ${workspaceId}`);
        }
      }
    });

    const started = await handlers.startRun({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      nodeId: 'term-1',
      runtime: 'shell',
      command: 'echo hello'
    });
    expect(started.run.status).toBe('queued');

    await waitFor(async () => {
      const current = await handlers.getRun({} as IpcMainInvokeEvent, { runId: started.run.id });
      return current.run.status === 'completed';
    }, 3000, 50);

    const stored = await handlers.getRun({} as IpcMainInvokeEvent, { runId: started.run.id });
    expect(stored.run.status).toBe('completed');
    expect(stored.run.summary).toContain('hello');
  });
});
