import crypto from 'node:crypto';
import type {
  AuditLogRecord,
  AuditLogStatus,
  WorkspaceRepository
} from '../db/workspace';

export interface AuditLogOptions {
  workspaceId: string;
  repository: WorkspaceRepository;
  now?: () => number;
  randomId?: () => string;
}

export interface PersistAuditInput {
  eventType: string;
  runId?: string | null;
  status: AuditLogStatus;
  message: string;
}

export interface AuditLog {
  persist: (input: PersistAuditInput) => AuditLogRecord;
}

export const createAuditLog = (options: AuditLogOptions): AuditLog => {
  const now = options.now ?? (() => Date.now());
  const randomId = options.randomId ?? (() => crypto.randomUUID());

  return {
    persist: (input: PersistAuditInput): AuditLogRecord => {
      return options.repository.appendAuditLog({
        id: randomId(),
        workspaceId: options.workspaceId,
        eventType: input.eventType,
        runId: input.runId ?? null,
        status: input.status,
        message: input.message,
        createdAtMs: now()
      });
    }
  };
};
