import type { RuntimeAdapterInput, RuntimeAdapterProcess } from './adapters/shell-runtime';
import { launchClaudeRuntime } from './adapters/claude-runtime';
import { launchCodexRuntime } from './adapters/codex-runtime';
import { launchShellRuntime } from './adapters/shell-runtime';

type RuntimeKind = 'shell' | 'codex' | 'claude';

interface StartRunMessage {
  type: 'start';
  runId: string;
  runtime: RuntimeKind;
  command: string;
  cwd?: string;
  env: Record<string, string | undefined>;
}

type IncomingMessage = StartRunMessage;

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

const MAX_TAIL_LENGTH = 4096;

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

const resolveRuntimeLauncher = (
  runtime: RuntimeKind
): ((input: RuntimeAdapterInput) => RuntimeAdapterProcess) => {
  if (runtime === 'shell') {
    return launchShellRuntime;
  }
  if (runtime === 'codex') {
    return launchCodexRuntime;
  }
  return launchClaudeRuntime;
};

let hasStartedRun = false;

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

    sendMessage({
      type: 'started',
      runId: message.runId,
      pid: runtimeProcess.pid ?? null
    });

    runtimeProcess.stdout.on('data', (chunk: Buffer | string) => {
      const value = chunk.toString();
      tail = appendTail(tail, value);
      sendMessage({
        type: 'stdout',
        runId: message.runId,
        chunk: value
      });
    });

    runtimeProcess.stderr.on('data', (chunk: Buffer | string) => {
      const value = chunk.toString();
      tail = appendTail(tail, value);
      sendMessage({
        type: 'stderr',
        runId: message.runId,
        chunk: value
      });
    });

    runtimeProcess.on('error', (error: Error) => {
      const chunk = `${error.message}\n`;
      tail = appendTail(tail, chunk);
      sendMessage({
        type: 'stderr',
        runId: message.runId,
        chunk
      });
    });

    runtimeProcess.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      sendMessage({
        type: 'exit',
        runId: message.runId,
        code,
        signal: signal ?? null,
        tail
      });
      setTimeout(() => {
        process.exit(0);
      }, 0);
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
    setTimeout(() => {
      process.exit(1);
    }, 0);
  }
};

const handleMessage = (message: unknown): void => {
  if (!message || typeof message !== 'object') {
    return;
  }

  const maybeStartMessage = message as Partial<StartRunMessage>;
  if (
    maybeStartMessage.type !== 'start' ||
    typeof maybeStartMessage.runId !== 'string' ||
    typeof maybeStartMessage.runtime !== 'string' ||
    typeof maybeStartMessage.command !== 'string' ||
    !maybeStartMessage.env
  ) {
    return;
  }

  handleStartMessage(maybeStartMessage as StartRunMessage);
};

if (parentPort) {
  parentPort.on('message', handleMessage);
} else {
  process.on('message', handleMessage);
}
