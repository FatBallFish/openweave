import { describe, expect, it, vi } from 'vitest';
import { createRuntimeBridge, type RuntimeStartRequest } from '../../../src/main/runtime/runtime-bridge';

interface StubWorker {
  worker: {
    postMessage: (message: unknown) => void;
    onMessage: (listener: (message: any) => void) => void;
    onExit: (listener: (code: number | null, signal: string | null) => void) => void;
    kill: () => void;
  };
  getPostedMessages: () => unknown[];
  emitMessage: (message: unknown) => void;
  emitExit: (code: number | null, signal: string | null) => void;
  getKillCount: () => number;
}

const createStubWorker = (): StubWorker => {
  const postedMessages: unknown[] = [];
  const messageListeners: Array<(message: unknown) => void> = [];
  const exitListeners: Array<(code: number | null, signal: string | null) => void> = [];
  let killCount = 0;

  return {
    worker: {
      postMessage: (message: unknown) => {
        postedMessages.push(message);
      },
      onMessage: (listener: (message: unknown) => void) => {
        messageListeners.push(listener);
      },
      onExit: (listener: (code: number | null, signal: string | null) => void) => {
        exitListeners.push(listener);
      },
      kill: () => {
        killCount += 1;
      }
    },
    getPostedMessages: () => postedMessages,
    emitMessage: (message: unknown) => {
      for (const listener of messageListeners) {
        listener(message);
      }
    },
    emitExit: (code: number | null, signal: string | null) => {
      for (const listener of exitListeners) {
        listener(code, signal);
      }
    },
    getKillCount: () => killCount
  };
};

describe('runtime bridge behavior', () => {
  it('starts workers, forwards lifecycle events, and stops active runs', () => {
    const stub = createStubWorker();
    let capturedRequest: RuntimeStartRequest | null = null;
    let capturedEnv: NodeJS.ProcessEnv | null = null;
    const bridge = createRuntimeBridge({
      spawnWorker: (request, env) => {
        capturedRequest = request;
        capturedEnv = env;
        return stub.worker;
      }
    });

    const started = vi.fn();
    const stdout = vi.fn();
    const stderr = vi.fn();
    const exited = vi.fn();
    bridge.on('started', started);
    bridge.on('stdout', stdout);
    bridge.on('stderr', stderr);
    bridge.on('exit', exited);

    bridge.start({
      runId: 'run-1',
      runtime: 'shell',
      command: 'echo hello',
      cwd: '/tmp/workspace',
      env: {
        OPENWEAVE_FLAG: '1'
      }
    });

    expect(capturedRequest?.cwd).toBe('/tmp/workspace');
    expect(capturedEnv?.OPENWEAVE_FLAG).toBe('1');
    expect(stub.getPostedMessages()).toHaveLength(1);

    stub.emitMessage({ type: 'started', runId: 'run-1', pid: 42 });
    stub.emitMessage({ type: 'stdout', runId: 'run-1', chunk: 'hello\n' });
    stub.emitMessage({ type: 'stderr', runId: 'run-1', chunk: 'warn\n' });
    stub.emitMessage({ type: 'exit', runId: 'run-1', code: 0, signal: null, tail: 'hello\nwarn\n' });

    expect(started).toHaveBeenCalledWith({ runId: 'run-1', pid: 42 });
    expect(stdout).toHaveBeenCalledWith({ runId: 'run-1', chunk: 'hello\n' });
    expect(stderr).toHaveBeenCalledWith({ runId: 'run-1', chunk: 'warn\n' });
    expect(exited).toHaveBeenCalledWith({
      runId: 'run-1',
      code: 0,
      signal: null,
      tail: 'hello\nwarn\n'
    });
    expect(bridge.stop('run-1')).toBe(false);
  });

  it('emits fallback exit when the worker exits without an exit message and dispose kills workers', () => {
    const stub = createStubWorker();
    const bridge = createRuntimeBridge({
      spawnWorker: () => stub.worker
    });
    const exited = vi.fn();
    bridge.on('exit', exited);

    bridge.start({
      runId: 'run-2',
      runtime: 'shell',
      command: 'echo hello'
    });
    stub.emitExit(1, 'SIGTERM');

    expect(exited).toHaveBeenCalledWith({
      runId: 'run-2',
      code: 1,
      signal: 'SIGTERM',
      tail: ''
    });

    bridge.start({
      runId: 'run-3',
      runtime: 'shell',
      command: 'echo again'
    });
    bridge.dispose();
    expect(stub.getKillCount()).toBeGreaterThan(0);
  });
});
