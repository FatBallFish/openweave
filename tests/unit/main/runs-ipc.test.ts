import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type {
  RuntimeBridge,
  RuntimeExitEvent,
  RuntimeStartedEvent,
  RuntimeStartRequest,
  RuntimeStreamEvent
} from '../../../src/main/runtime/runtime-bridge';
import { createRunsIpcHandlers } from '../../../src/main/ipc/runs';

const createRuntimeBridgeStub = (): RuntimeBridge & {
  starts: RuntimeStartRequest[];
  inputs: Array<{ runId: string; input: string }>;
} => {
  const emitter = new EventEmitter();
  const starts: RuntimeStartRequest[] = [];
  const inputs: Array<{ runId: string; input: string }> = [];

  const bridge = {
    starts,
    inputs,
    start: (request) => {
      starts.push(request);
    },
    input: (runId, input) => {
      inputs.push({ runId, input });
      return starts.some((request) => request.runId === runId);
    },
    stop: (runId) => starts.some((request) => request.runId === runId),
    resize: vi.fn(),
    dispose: vi.fn(),
    on: (
      event: 'started' | 'stdout' | 'stderr' | 'exit',
      listener:
        | ((event: RuntimeStartedEvent) => void)
        | ((event: RuntimeStreamEvent) => void)
        | ((event: RuntimeExitEvent) => void)
    ) => {
      emitter.on(event, listener);
      return bridge;
    },
    off: (
      event: 'started' | 'stdout' | 'stderr' | 'exit',
      listener:
        | ((event: RuntimeStartedEvent) => void)
        | ((event: RuntimeStreamEvent) => void)
        | ((event: RuntimeExitEvent) => void)
    ) => {
      emitter.off(event, listener);
      return bridge;
    }
  } as RuntimeBridge & {
    starts: RuntimeStartRequest[];
    inputs: Array<{ runId: string; input: string }>;
  };

  return bridge;
};

describe('runs IPC handlers', () => {
  it('allows concurrent managed terminal runs and routes input by run id', async () => {
    const bridge = createRuntimeBridgeStub();
    const randomIds = ['run-codex-1', 'run-claude-1', 'run-codex-2'];
    const handlers = createRunsIpcHandlers({
      assertWorkspaceExists: vi.fn(),
      runtimeBridge: bridge,
      randomId: () => randomIds.shift() ?? 'run-extra',
      now: () => 1000,
      launchEnv: {}
    });

    const firstCodex = await handlers.startRun({} as never, {
      workspaceId: 'ws-1',
      nodeId: 'terminal-1',
      runtime: 'codex',
      command: ''
    });
    const claude = await handlers.startRun({} as never, {
      workspaceId: 'ws-1',
      nodeId: 'terminal-2',
      runtime: 'claude',
      command: ''
    });
    const secondCodex = await handlers.startRun({} as never, {
      workspaceId: 'ws-1',
      nodeId: 'terminal-3',
      runtime: 'codex',
      command: ''
    });

    expect(firstCodex.run.status).toBe('queued');
    expect(claude.run.status).toBe('queued');
    expect(secondCodex.run.status).toBe('queued');
    expect(bridge.starts.map((request) => [request.runId, request.runtime])).toEqual([
      ['run-codex-1', 'codex'],
      ['run-claude-1', 'claude'],
      ['run-codex-2', 'codex']
    ]);

    await handlers.inputRun({} as never, {
      workspaceId: 'ws-1',
      runId: 'run-codex-1',
      input: 'first'
    });
    await handlers.inputRun({} as never, {
      workspaceId: 'ws-1',
      runId: 'run-codex-2',
      input: 'second'
    });

    expect(bridge.inputs).toEqual([
      { runId: 'run-codex-1', input: 'first' },
      { runId: 'run-codex-2', input: 'second' }
    ]);
  });
});
