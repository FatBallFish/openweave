import type { RunRecord } from '../../shared/ipc/contracts';
import type { AuditLog } from '../audit/audit-log';
import type { AuditLogRecord, WorkspaceRepository } from '../db/workspace';

const RECOVERY_FAILURE_SUMMARY = 'Recovered after unclean shutdown';
const RECOVERY_EVENT_TYPE = 'run.recovered';

const isRecoverableRunStatus = (status: RunRecord['status']): boolean => {
  return status === 'queued' || status === 'running';
};

export interface RecoveryServiceOptions {
  workspaceId: string;
  repository: WorkspaceRepository;
  auditLog: AuditLog;
  now?: () => number;
}

export interface RecoveryWorkspaceState {
  runs: RunRecord[];
  audits: AuditLogRecord[];
}

export interface RecoveryService {
  recoverWorkspace: () => RecoveryWorkspaceState;
}

export const createRecoveryService = (options: RecoveryServiceOptions): RecoveryService => {
  const now = options.now ?? (() => Date.now());

  return {
    recoverWorkspace: (): RecoveryWorkspaceState => {
      const recoverableRuns = options.repository
        .listRuns()
        .filter((run) => isRecoverableRunStatus(run.status));
      const existingRecoveryAuditRunIds = new Set(
        options.repository
          .listAuditLogs(1000)
          .filter((audit) => audit.eventType === RECOVERY_EVENT_TYPE && typeof audit.runId === 'string')
          .map((audit) => audit.runId as string)
      );

      for (const run of recoverableRuns) {
        options.repository.saveRun({
          ...run,
          status: 'failed',
          summary: RECOVERY_FAILURE_SUMMARY,
          completedAtMs: run.completedAtMs ?? now()
        });

        if (!existingRecoveryAuditRunIds.has(run.id)) {
          options.auditLog.persist({
            eventType: RECOVERY_EVENT_TYPE,
            runId: run.id,
            status: 'success',
            message: RECOVERY_FAILURE_SUMMARY
          });
          existingRecoveryAuditRunIds.add(run.id);
        }
      }

      return {
        runs: options.repository.listRuns(),
        audits: options.repository.listAuditLogs()
      };
    }
  };
};
