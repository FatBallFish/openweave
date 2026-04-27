import {
  type RuntimeAdapterInput,
  type RuntimeAdapterProcess
} from './shell-runtime';
import { launchManagedRuntimeInShell } from './managed-runtime';

const CODEX_SUBMIT_SPLIT_DELAY_MS = 32;

interface CodexWriteChunk {
  value: string;
  delayMs: number;
}

const splitCodexWriteChunks = (value: string): CodexWriteChunk[] => {
  if (value.length === 0) {
    return [];
  }

  if (value === '\r' || !value.endsWith('\r')) {
    return [
      {
        value,
        delayMs: 0
      }
    ];
  }

  const body = value.slice(0, -1);
  if (body.length === 0) {
    return [
      {
        value: '\r',
        delayMs: 0
      }
    ];
  }

  return [
    {
      value: body,
      delayMs: 0
    },
    {
      value: '\r',
      delayMs: CODEX_SUBMIT_SPLIT_DELAY_MS
    }
  ];
};

export const launchCodexRuntime = (input: RuntimeAdapterInput): RuntimeAdapterProcess => {
  const runtimeProcess = launchManagedRuntimeInShell(input, 'codex');
  const baseWrite = runtimeProcess.write.bind(runtimeProcess);
  const pendingChunks: CodexWriteChunk[] = [];
  let drainTimer: NodeJS.Timeout | null = null;
  let draining = false;
  let closed = false;

  const clearDrainTimer = (): void => {
    if (drainTimer !== null) {
      clearTimeout(drainTimer);
      drainTimer = null;
    }
  };

  const drainNextChunk = (): void => {
    if (closed || draining) {
      return;
    }

    const nextChunk = pendingChunks.shift();
    if (!nextChunk) {
      return;
    }

    if (nextChunk.delayMs > 0) {
      draining = true;
      drainTimer = setTimeout(() => {
        drainTimer = null;
        draining = false;
        if (closed) {
          return;
        }
        baseWrite(nextChunk.value);
        drainNextChunk();
      }, nextChunk.delayMs);
      return;
    }

    baseWrite(nextChunk.value);
    drainNextChunk();
  };

  runtimeProcess.write = (value: string): void => {
    if (closed) {
      return;
    }

    // Codex treats "text + Enter" differently when they arrive in the same PTY write.
    const chunks = splitCodexWriteChunks(value);
    if (chunks.length === 0) {
      return;
    }

    if (pendingChunks.length === 0 && !draining && chunks.length === 1 && chunks[0]?.delayMs === 0) {
      baseWrite(chunks[0].value);
      return;
    }

    pendingChunks.push(...chunks);
    drainNextChunk();
  };

  runtimeProcess.on('close', () => {
    closed = true;
    pendingChunks.length = 0;
    clearDrainTimer();
  });

  return runtimeProcess;
};
