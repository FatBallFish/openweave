import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface PortalActionFileBridgeInput {
  workspaceId: string;
  targetNodeId: string;
  action: string;
  payload?: Record<string, unknown>;
}

interface PortalActionRequestRecord extends PortalActionFileBridgeInput {
  id: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  createdAtMs: number;
  updatedAtMs: number;
  result?: unknown;
  error?: string;
}

export interface PortalActionFileClient {
  dispatch: (input: PortalActionFileBridgeInput) => Promise<unknown>;
}

export interface CreatePortalActionFileClientOptions {
  requestsDir: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export interface StartPortalActionFileServerOptions {
  requestsDir: string;
  pollIntervalMs?: number;
  dispatch: (input: PortalActionFileBridgeInput) => Promise<unknown>;
}

const DEFAULT_CLIENT_TIMEOUT_MS = 30_000;
const DEFAULT_POLL_INTERVAL_MS = 50;

const wait = async (durationMs: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
};

const ensureRequestsDir = (requestsDir: string): void => {
  fs.mkdirSync(requestsDir, { recursive: true });
};

const toRequestPath = (requestsDir: string, requestId: string): string => {
  return path.join(requestsDir, `${requestId}.json`);
};

const writeRequestRecord = (filePath: string, record: PortalActionRequestRecord): void => {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(record), 'utf8');
  fs.renameSync(tempPath, filePath);
};

const readRequestRecord = (filePath: string): PortalActionRequestRecord | null => {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as Partial<PortalActionRequestRecord>;
    if (
      typeof record.id !== 'string' ||
      typeof record.workspaceId !== 'string' ||
      typeof record.targetNodeId !== 'string' ||
      typeof record.action !== 'string' ||
      (record.status !== 'pending' &&
        record.status !== 'processing' &&
        record.status !== 'success' &&
        record.status !== 'failed')
    ) {
      return null;
    }
    return record as PortalActionRequestRecord;
  } catch {
    return null;
  }
};

export const createPortalActionFileClient = (
  options: CreatePortalActionFileClientOptions
): PortalActionFileClient => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_CLIENT_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  return {
    dispatch: async (input): Promise<unknown> => {
      ensureRequestsDir(options.requestsDir);
      const requestId = crypto.randomUUID();
      const filePath = toRequestPath(options.requestsDir, requestId);
      const timestamp = Date.now();
      writeRequestRecord(filePath, {
        id: requestId,
        workspaceId: input.workspaceId,
        targetNodeId: input.targetNodeId,
        action: input.action,
        payload: input.payload,
        status: 'pending',
        createdAtMs: timestamp,
        updatedAtMs: timestamp
      });

      const expiresAt = timestamp + timeoutMs;
      while (Date.now() <= expiresAt) {
        const record = readRequestRecord(filePath);
        if (record?.status === 'success') {
          return record.result;
        }
        if (record?.status === 'failed') {
          throw new Error(record.error ?? 'PORTAL_ACTION_FAILED');
        }
        await wait(pollIntervalMs);
      }

      throw new Error(`PORTAL_ACTION_TIMEOUT: ${input.action}`);
    }
  };
};

export const startPortalActionFileServer = (
  options: StartPortalActionFileServerOptions
): (() => void) => {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const processing = new Set<string>();
  let disposed = false;
  let activePoll: Promise<void> | null = null;

  const processPendingRequests = async (): Promise<void> => {
    if (disposed) {
      return;
    }
    ensureRequestsDir(options.requestsDir);
    const fileNames = fs.readdirSync(options.requestsDir).filter((fileName) => fileName.endsWith('.json'));
    for (const fileName of fileNames) {
      if (disposed) {
        return;
      }
      const filePath = path.join(options.requestsDir, fileName);
      const record = readRequestRecord(filePath);
      if (!record || record.status !== 'pending' || processing.has(record.id)) {
        continue;
      }

      processing.add(record.id);
      const processingRecord: PortalActionRequestRecord = {
        ...record,
        status: 'processing',
        updatedAtMs: Date.now()
      };
      writeRequestRecord(filePath, processingRecord);

      try {
        const result = await options.dispatch({
          workspaceId: record.workspaceId,
          targetNodeId: record.targetNodeId,
          action: record.action,
          payload: record.payload
        });
        writeRequestRecord(filePath, {
          ...processingRecord,
          status: 'success',
          result,
          updatedAtMs: Date.now()
        });
      } catch (error) {
        writeRequestRecord(filePath, {
          ...processingRecord,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          updatedAtMs: Date.now()
        });
      } finally {
        processing.delete(record.id);
      }
    }
  };

  const timer = setInterval(() => {
    if (!activePoll) {
      activePoll = processPendingRequests().finally(() => {
        activePoll = null;
      });
    }
  }, pollIntervalMs);
  activePoll = processPendingRequests().finally(() => {
    activePoll = null;
  });

  return () => {
    disposed = true;
    clearInterval(timer);
  };
};
