import { EventEmitter } from 'node:events';
import Module from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import type {
  RuntimeBridge,
  RuntimeExitEvent,
  RuntimeStartedEvent,
  RuntimeStartRequest,
  RuntimeStreamEvent
} from '../../../src/main/runtime/runtime-bridge';
import { createRunsIpcHandlers } from '../../../src/main/ipc/runs';

const webContentsSend = vi.fn();
const moduleLoader = Module as typeof Module & {
  _load: (request: string, parent: NodeModule | null | undefined, isMain: boolean) => unknown;
};
const originalModuleLoad = moduleLoader._load;

const createRuntimeBridgeStub = (): RuntimeBridge & {
  starts: RuntimeStartRequest[];
  inputs: Array<{ runId: string; input: string }>;
  emitRuntimeStream: (event: RuntimeStreamEvent) => void;
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
    emitRuntimeStream: (event: RuntimeStreamEvent) => {
      emitter.emit('stdout', event);
    },
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
    emitRuntimeStream: (event: RuntimeStreamEvent) => void;
  };

  return bridge;
};

describe('runs IPC handlers', () => {
  it('exposes monotonic output offsets in stream events and run snapshots', async () => {
    webContentsSend.mockClear();
    moduleLoader._load = ((request, parent, isMain) => {
      if (request === 'electron') {
        return {
          webContents: {
            fromId: (id: number) => {
              if (id !== 7) {
                return null;
              }

              return {
                isDestroyed: () => false,
                send: webContentsSend
              };
            }
          }
        };
      }

      return originalModuleLoad(request, parent, isMain);
    }) as typeof moduleLoader._load;

    try {
      const bridge = createRuntimeBridgeStub();
      const handlers = createRunsIpcHandlers({
        assertWorkspaceExists: vi.fn(),
        runtimeBridge: bridge,
        randomId: () => 'run-offsets',
        now: () => 1000,
        launchEnv: {}
      });

      const started = await handlers.startRun({} as never, {
        workspaceId: 'ws-1',
        nodeId: 'terminal-1',
        runtime: 'shell',
        command: 'echo hi'
      });
      handlers.subscribeStream(started.run.id, 7);

      bridge.emitRuntimeStream({
        runId: started.run.id,
        chunk: 'abc'
      });
      bridge.emitRuntimeStream({
        runId: started.run.id,
        chunk: 'de'
      });

      const fetched = await handlers.getRun({} as never, {
        workspaceId: 'ws-1',
        runId: started.run.id
      });
      const listed = await handlers.listRuns({} as never, {
        workspaceId: 'ws-1',
        nodeId: 'terminal-1'
      });

      expect(webContentsSend.mock.calls).toEqual([
        [
          'run:stream',
          {
            runId: 'run-offsets',
            chunk: 'abc',
            chunkStartOffset: 0,
            chunkEndOffset: 3
          }
        ],
        [
          'run:stream',
          {
            runId: 'run-offsets',
            chunk: 'de',
            chunkStartOffset: 3,
            chunkEndOffset: 5
          }
        ]
      ]);
      expect(fetched.run).toMatchObject({
        tailLog: 'abcde',
        tailStartOffset: 0,
        tailEndOffset: 5
      });
      expect(listed.runs[0]).toMatchObject({
        tailLog: 'abcde',
        tailStartOffset: 0,
        tailEndOffset: 5
      });
    } finally {
      moduleLoader._load = originalModuleLoad;
    }
  });

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
