import type { RunRecord } from '../../shared/ipc/contracts';
import type { AuditLog } from '../audit/audit-log';
import type { AuditLogRecord, WorkspaceRepository } from '../db/workspace';

const RECOVERY_FAILURE_SUMMARY = 'Recovered after unclean shutdown';

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
      const runningRuns = options.repository.listRunsByStatus('running');

      for (const run of runningRuns) {
        options.repository.saveRun({
          ...run,
          status: 'failed',
          summary: RECOVERY_FAILURE_SUMMARY,
          completedAtMs: run.completedAtMs ?? now()
        });
        options.auditLog.persist({
          eventType: 'run.recovered',
          runId: run.id,
          status: 'success',
          message: RECOVERY_FAILURE_SUMMARY
        });
      }

      return {
        runs: options.repository.listRuns(),
        audits: options.repository.listAuditLogs()
      };
    }
  };
};
