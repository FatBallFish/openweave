import { fork as forkProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import type { RunRuntimeInput } from '../../shared/ipc/schemas';

interface RuntimeStartWorkerMessage {
  type: 'start';
  runId: string;
  runtime: RunRuntimeInput;
  command: string;
  cwd?: string;
  env: Record<string, string | undefined>;
}

interface RuntimeStartedWorkerEvent {
  type: 'started';
  runId: string;
  pid: number | null;
}

interface RuntimeStreamWorkerEvent {
  type: 'stdout' | 'stderr';
  runId: string;
  chunk: string;
}

interface RuntimeExitWorkerEvent {
  type: 'exit';
  runId: string;
  code: number | null;
  signal: string | null;
  tail: string;
}

type RuntimeWorkerEvent = RuntimeStartedWorkerEvent | RuntimeStreamWorkerEvent | RuntimeExitWorkerEvent;

export interface RuntimeStartRequest {
  runId: string;
  runtime: RunRuntimeInput;
  command: string;
  cwd?: string;
  env?: Record<string, string | undefined>;
}

export interface RuntimeStartedEvent {
  runId: string;
  pid: number | null;
}

export interface RuntimeStreamEvent {
  runId: string;
  chunk: string;
}

export interface RuntimeExitEvent {
  runId: string;
  code: number | null;
  signal: string | null;
  tail: string;
}

interface RuntimeWorkerHandle {
  postMessage: (message: RuntimeStartWorkerMessage) => void;
  onMessage: (listener: (message: RuntimeWorkerEvent) => void) => void;
  onExit: (listener: (code: number | null, signal: string | null) => void) => void;
  kill: () => void;
}

export interface RuntimeBridge {
  start: (request: RuntimeStartRequest) => void;
  stop: (runId: string) => boolean;
  dispose: () => void;
  on: {
    (event: 'started', listener: (event: RuntimeStartedEvent) => void): RuntimeBridge;
    (event: 'stdout', listener: (event: RuntimeStreamEvent) => void): RuntimeBridge;
    (event: 'stderr', listener: (event: RuntimeStreamEvent) => void): RuntimeBridge;
    (event: 'exit', listener: (event: RuntimeExitEvent) => void): RuntimeBridge;
  };
  off: {
    (event: 'started', listener: (event: RuntimeStartedEvent) => void): RuntimeBridge;
    (event: 'stdout', listener: (event: RuntimeStreamEvent) => void): RuntimeBridge;
    (event: 'stderr', listener: (event: RuntimeStreamEvent) => void): RuntimeBridge;
    (event: 'exit', listener: (event: RuntimeExitEvent) => void): RuntimeBridge;
  };
}

export interface RuntimeBridgeOptions {
  spawnWorker?: (request: RuntimeStartRequest, env: NodeJS.ProcessEnv) => RuntimeWorkerHandle;
}

const resolveRuntimeWorkerPath = (): string => {
  const candidates = [
    path.resolve(__dirname, '..', 'worker', 'runtime-worker.js'),
    path.resolve(process.cwd(), 'dist/worker/runtime-worker.js')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('Runtime worker entry not found');
};

const buildRuntimeLaunchEnv = (
  baseEnv: NodeJS.ProcessEnv,
  overrides: Record<string, string | undefined> | undefined
): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {};

  for (const [key, value] of Object.entries(baseEnv)) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }

  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }

  if (typeof baseEnv.SystemRoot === 'string' && typeof env.SystemRoot !== 'string') {
    env.SystemRoot = baseEnv.SystemRoot;
  }

  return env;
};

const createUtilityProcessWorker = (
  workerPath: string,
  request: RuntimeStartRequest,
  env: NodeJS.ProcessEnv
): RuntimeWorkerHandle | null => {
  try {
    const electronModule = require('electron') as typeof import('electron');
    const fork = (electronModule.utilityProcess as any)?.fork as
      | ((modulePath: string, args?: string[], options?: Record<string, unknown>) => any)
      | undefined;

    if (!fork) {
      return null;
    }

    const utilityProcess = fork(workerPath, [], {
      serviceName: `openweave-runtime-${request.runId}`,
      cwd: request.cwd,
      env
    });

    return {
      postMessage: (message: RuntimeStartWorkerMessage): void => {
        utilityProcess.postMessage(message);
      },
      onMessage: (listener: (message: RuntimeWorkerEvent) => void): void => {
        utilityProcess.on('message', (...args: unknown[]) => {
          const payload = args.length > 1 ? args[1] : args[0];
          const message =
            payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)
              ? (payload as { data: RuntimeWorkerEvent }).data
              : (payload as RuntimeWorkerEvent);
          listener(message);
        });
      },
      onExit: (listener: (code: number | null, signal: string | null) => void): void => {
        utilityProcess.on('exit', (...args: unknown[]) => {
          const codeArg = args.find((arg) => typeof arg === 'number');
          const signalArg = args.find((arg) => typeof arg === 'string');
          const code = typeof codeArg === 'number' ? codeArg : null;
          const signal = typeof signalArg === 'string' ? signalArg : null;
          listener(code, signal);
        });
      },
      kill: (): void => {
        utilityProcess.kill();
      }
    };
  } catch {
    return null;
  }
};

const createForkedWorker = (
  workerPath: string,
  request: RuntimeStartRequest,
  env: NodeJS.ProcessEnv
): RuntimeWorkerHandle => {
  const child = forkProcess(workerPath, [], {
    cwd: request.cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });

  return {
    postMessage: (message: RuntimeStartWorkerMessage): void => {
      child.send(message);
    },
    onMessage: (listener: (message: RuntimeWorkerEvent) => void): void => {
      child.on('message', (message: RuntimeWorkerEvent) => {
        listener(message);
      });
    },
    onExit: (listener: (code: number | null, signal: string | null) => void): void => {
      child.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
        listener(code, signal ?? null);
      });
    },
    kill: (): void => {
      child.kill();
    }
  };
};

const createDefaultSpawnWorker = (
  request: RuntimeStartRequest,
  env: NodeJS.ProcessEnv
): RuntimeWorkerHandle => {
  const workerPath = resolveRuntimeWorkerPath();
  const preferUtilityProcess = process.env.OPENWEAVE_RUNTIME_USE_UTILITY_PROCESS === '1';
  if (preferUtilityProcess) {
    const utilityProcessWorker = createUtilityProcessWorker(workerPath, request, env);
    if (utilityProcessWorker) {
      return utilityProcessWorker;
    }
  }
  return createForkedWorker(workerPath, request, env);
};

class RuntimeBridgeImpl extends EventEmitter implements RuntimeBridge {
  private readonly workers = new Map<string, RuntimeWorkerHandle>();

  private readonly spawnWorker: (request: RuntimeStartRequest, env: NodeJS.ProcessEnv) => RuntimeWorkerHandle;

  constructor(options: RuntimeBridgeOptions) {
    super();
    this.spawnWorker = options.spawnWorker ?? createDefaultSpawnWorker;
  }

  public start(request: RuntimeStartRequest): void {
    if (this.workers.has(request.runId)) {
      throw new Error(`Run already exists: ${request.runId}`);
    }

    const env = buildRuntimeLaunchEnv(process.env, request.env);
    const worker = this.spawnWorker(request, env);
    let exitReported = false;

    worker.onMessage((message: RuntimeWorkerEvent) => {
      if (!message || message.runId !== request.runId) {
        return;
      }

      switch (message.type) {
        case 'started':
          this.emit('started', {
            runId: message.runId,
            pid: message.pid
          } satisfies RuntimeStartedEvent);
          return;
        case 'stdout':
          this.emit('stdout', {
            runId: message.runId,
            chunk: message.chunk
          } satisfies RuntimeStreamEvent);
          return;
        case 'stderr':
          this.emit('stderr', {
            runId: message.runId,
            chunk: message.chunk
          } satisfies RuntimeStreamEvent);
          return;
        case 'exit':
          exitReported = true;
          this.emit('exit', {
            runId: message.runId,
            code: message.code,
            signal: message.signal,
            tail: message.tail
          } satisfies RuntimeExitEvent);
          this.workers.delete(message.runId);
          return;
      }
    });

    worker.onExit((code: number | null, signal: string | null) => {
      if (exitReported) {
        return;
      }

      this.emit('exit', {
        runId: request.runId,
        code,
        signal,
        tail: ''
      } satisfies RuntimeExitEvent);
      this.workers.delete(request.runId);
    });

    this.workers.set(request.runId, worker);
    worker.postMessage({
      type: 'start',
      runId: request.runId,
      runtime: request.runtime,
      command: request.command,
      cwd: request.cwd,
      env
    });
  }

  public stop(runId: string): boolean {
    const worker = this.workers.get(runId);
    if (!worker) {
      return false;
    }

    worker.kill();
    this.workers.delete(runId);
    return true;
  }

  public dispose(): void {
    for (const worker of this.workers.values()) {
      worker.kill();
    }
    this.workers.clear();
    this.removeAllListeners();
  }
}

export const createRuntimeBridge = (options: RuntimeBridgeOptions = {}): RuntimeBridge => {
  return new RuntimeBridgeImpl(options);
};
