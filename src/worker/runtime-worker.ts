import type { RuntimeAdapterInput, RuntimeAdapterProcess } from './adapters/shell-runtime';
import { launchClaudeRuntime } from './adapters/claude-runtime';
import { launchCodexRuntime } from './adapters/codex-runtime';
import { launchOpenCodeRuntime } from './adapters/opencode-runtime';
import { launchShellRuntime } from './adapters/shell-runtime';

type RuntimeKind = 'shell' | 'codex' | 'claude' | 'opencode';
const RUNTIME_KINDS = new Set<RuntimeKind>(['shell', 'codex', 'claude', 'opencode']);
const MAX_TAIL_LENGTH = 4096;
const INTERRUPT_INPUT = '\u0003';
const STOP_KILL_DELAY_MS = 250;

interface StartRunMessage {
  type: 'start';
  runId: string;
  runtime: RuntimeKind;
  command: string;
  cwd?: string;
  env: Record<string, string | undefined>;
}

interface InputRunMessage {
  type: 'input';
  runId: string;
  input: string;
}

interface StopRunMessage {
  type: 'stop';
  runId: string;
}

interface ResizeRunMessage {
  type: 'resize';
  runId: string;
  cols: number;
  rows: number;
}

type IncomingMessage = StartRunMessage | InputRunMessage | StopRunMessage | ResizeRunMessage;

interface StartedEvent {
  type: 'started';
  runId: string;
  pid: number | null;
}

interface StreamEvent {
  type: 'stdout' | 'stderr';
  runId: string;
  chunk: string;
}

interface ExitEvent {
  type: 'exit';
  runId: string;
  code: number | null;
  signal: string | null;
  tail: string;
}

type OutgoingMessage = StartedEvent | StreamEvent | ExitEvent;

interface ParentPortLike {
  on: (event: 'message', listener: (message: unknown) => void) => void;
  postMessage: (message: unknown) => void;
}

interface ActiveRunState {
  runId: string;
  runtimeProcess: RuntimeAdapterProcess;
  tail: string;
  stopTimer: NodeJS.Timeout | null;
}

const getParentPort = (): ParentPortLike | null => {
  const maybeParentPort = (process as NodeJS.Process & { parentPort?: ParentPortLike }).parentPort;
  return maybeParentPort ?? null;
};

const parentPort = getParentPort();

const sendMessage = (message: OutgoingMessage): void => {
  if (parentPort) {
    parentPort.postMessage(message);
    return;
  }

  if (typeof process.send === 'function') {
    process.send(message);
  }
};

const appendTail = (currentTail: string, chunk: string): string => {
  const nextTail = `${currentTail}${chunk}`;
  return nextTail.length > MAX_TAIL_LENGTH ? nextTail.slice(nextTail.length - MAX_TAIL_LENGTH) : nextTail;
};

const toRuntimeEnv = (input: Record<string, string | undefined>): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }
  return env;
};

export type RuntimeWorkerErrorCode = 'RUNTIME_UNSUPPORTED';

export class RuntimeWorkerError extends Error {
  public readonly code: RuntimeWorkerErrorCode;

  constructor(code: RuntimeWorkerErrorCode, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'RuntimeWorkerError';
    this.code = code;
  }
}

const createUnsupportedRuntimeError = (runtime: string): RuntimeWorkerError => {
  return new RuntimeWorkerError('RUNTIME_UNSUPPORTED', `Unsupported runtime: ${runtime}`);
};

export const resolveRuntimeLauncher = (
  runtime: RuntimeKind
): ((input: RuntimeAdapterInput) => RuntimeAdapterProcess) => {
  switch (runtime) {
    case 'shell':
      return launchShellRuntime;
    case 'codex':
      return launchCodexRuntime;
    case 'claude':
      return launchClaudeRuntime;
    case 'opencode':
      return launchOpenCodeRuntime;
    default:
      throw createUnsupportedRuntimeError(String(runtime));
  }
};

const isRuntimeKind = (value: string): value is RuntimeKind => {
  return RUNTIME_KINDS.has(value as RuntimeKind);
};

let hasStartedRun = false;
let activeRun: ActiveRunState | null = null;

const exitWorker = (code: number): void => {
  setTimeout(() => {
    process.exit(code);
  }, 0);
};

const clearStopTimer = (): void => {
  if (!activeRun?.stopTimer) {
    return;
  }

  clearTimeout(activeRun.stopTimer);
  activeRun.stopTimer = null;
};

const handleRuntimeExit = (
  runId: string,
  tail: string,
  code: number | null,
  signal: NodeJS.Signals | null
): void => {
  clearStopTimer();
  sendMessage({
    type: 'exit',
    runId,
    code,
    signal: signal ?? null,
    tail
  });
  activeRun = null;
  exitWorker(code === 0 ? 0 : 1);
};

const handleStartMessage = (message: StartRunMessage): void => {
  if (hasStartedRun) {
    return;
  }
  hasStartedRun = true;

  let tail = '';

  try {
    const launch = resolveRuntimeLauncher(message.runtime);
    const runtimeProcess = launch({
      command: message.command,
      cwd: message.cwd,
      env: toRuntimeEnv(message.env)
    });

    activeRun = {
      runId: message.runId,
      runtimeProcess,
      tail,
      stopTimer: null
    };

    sendMessage({
      type: 'started',
      runId: message.runId,
      pid: runtimeProcess.pid ?? null
    });

    runtimeProcess.stdout.on('data', (chunk: Buffer | string) => {
      const value = chunk.toString();
      tail = appendTail(tail, value);
      if (activeRun?.runId === message.runId) {
        activeRun.tail = tail;
      }
      sendMessage({
        type: 'stdout',
        runId: message.runId,
        chunk: value
      });
    });

    runtimeProcess.stderr.on('data', (chunk: Buffer | string) => {
      const value = chunk.toString();
      tail = appendTail(tail, value);
      if (activeRun?.runId === message.runId) {
        activeRun.tail = tail;
      }
      sendMessage({
        type: 'stderr',
        runId: message.runId,
        chunk: value
      });
    });

    runtimeProcess.on('error', (error: Error) => {
      const chunk = `${error.message}\n`;
      tail = appendTail(tail, chunk);
      if (activeRun?.runId === message.runId) {
        activeRun.tail = tail;
      }
      sendMessage({
        type: 'stderr',
        runId: message.runId,
        chunk
      });
    });

    runtimeProcess.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      handleRuntimeExit(message.runId, tail, code, signal);
    });
  } catch (error) {
    const chunk = error instanceof Error ? `${error.message}\n` : 'Runtime launch failed\n';
    tail = appendTail(tail, chunk);
    sendMessage({
      type: 'stderr',
      runId: message.runId,
      chunk
    });
    sendMessage({
      type: 'exit',
      runId: message.runId,
      code: 1,
      signal: null,
      tail
    });
    activeRun = null;
    exitWorker(1);
  }
};

const handleInputMessage = (message: InputRunMessage): void => {
  if (!activeRun || activeRun.runId !== message.runId) {
    return;
  }

  try {
    activeRun.runtimeProcess.write(message.input);
  } catch (error) {
    const chunk = error instanceof Error ? `${error.message}\n` : 'Runtime input failed\n';
    activeRun.tail = appendTail(activeRun.tail, chunk);
    sendMessage({
      type: 'stderr',
      runId: message.runId,
      chunk
    });
  }
};

const handleStopMessage = (message: StopRunMessage): void => {
  if (!activeRun || activeRun.runId !== message.runId) {
    return;
  }
  if (activeRun.stopTimer) {
    return;
  }

  try {
    activeRun.runtimeProcess.write(INTERRUPT_INPUT);
  } catch {
    // Fall through to the timed kill below when the PTY cannot accept Ctrl-C.
  }

  activeRun.stopTimer = setTimeout(() => {
    try {
      activeRun?.runtimeProcess.kill('SIGTERM');
    } catch {
      // Best-effort stop; the bridge will still tear down the worker if it lingers.
    }
  }, STOP_KILL_DELAY_MS);
};

const handleMessage = (message: unknown): void => {
  if (!message || typeof message !== 'object') {
    return;
  }

  const typedMessage = message as Partial<IncomingMessage>;
  if (typedMessage.type === 'input') {
    if (typeof typedMessage.runId === 'string' && typeof typedMessage.input === 'string') {
      handleInputMessage(typedMessage as InputRunMessage);
    }
    return;
  }

  if (typedMessage.type === 'stop') {
    if (typeof typedMessage.runId === 'string') {
      handleStopMessage(typedMessage as StopRunMessage);
    }
    return;
  }

  if (typedMessage.type === 'resize') {
    if (
      typeof typedMessage.runId === 'string' &&
      typeof typedMessage.cols === 'number' &&
      typeof typedMessage.rows === 'number' &&
      activeRun &&
      activeRun.runId === typedMessage.runId
    ) {
      try {
        activeRun.runtimeProcess.resize(typedMessage.cols, typedMessage.rows);
      } catch {
        // Best-effort resize
      }
    }
    return;
  }

  if (
    typedMessage.type !== 'start' ||
    typeof typedMessage.runId !== 'string' ||
    typeof typedMessage.runtime !== 'string' ||
    typeof typedMessage.command !== 'string' ||
    !typedMessage.env
  ) {
    return;
  }

  if (!isRuntimeKind(typedMessage.runtime)) {
    const chunk = `${createUnsupportedRuntimeError(typedMessage.runtime).message}\n`;
    sendMessage({
      type: 'stderr',
      runId: typedMessage.runId,
      chunk
    });
    sendMessage({
      type: 'exit',
      runId: typedMessage.runId,
      code: 1,
      signal: null,
      tail: chunk
    });
    exitWorker(1);
    return;
  }

  handleStartMessage({
    ...typedMessage,
    runtime: typedMessage.runtime
  } as StartRunMessage);
};

if (parentPort) {
  parentPort.on('message', handleMessage);
} else {
  process.on('message', handleMessage);
}
