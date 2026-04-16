import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAuditLog } from '../../../src/main/audit/audit-log';
import { createWorkspaceRepository, type WorkspaceRepository } from '../../../src/main/db/workspace';
import { createRecoveryService } from '../../../src/main/recovery/recovery-service';

let testDbDir = '';
let repository: WorkspaceRepository;

beforeEach(() => {
  testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-recovery-'));
  repository = createWorkspaceRepository({
    dbFilePath: path.join(testDbDir, 'ws-1.db')
  });
});

afterEach(() => {
  repository.close();
  fs.rmSync(testDbDir, { recursive: true, force: true });
});

describe('recovery service', () => {
  it('marks queued and running runs as failed after an unclean shutdown and preserves tail logs', async () => {
    repository.saveRun({
      id: 'run-queued-1',
      workspaceId: 'ws-1',
      nodeId: 'terminal-1',
      runtime: 'shell',
      command: 'echo queued',
      status: 'queued',
      summary: null,
      tailLog: 'queued tail last 4kb\n',
      createdAtMs: 1,
      startedAtMs: null,
      completedAtMs: null
    });

    repository.saveRun({
      id: 'run-running-1',
      workspaceId: 'ws-1',
      nodeId: 'terminal-1',
      runtime: 'shell',
      command: 'echo hello',
      status: 'running',
      summary: null,
      tailLog: 'hello\nlast 4kb\n',
      createdAtMs: 1,
      startedAtMs: 2,
      completedAtMs: null
    });

    const recovered = createRecoveryService({
      workspaceId: 'ws-1',
      repository,
      auditLog: createAuditLog({
        workspaceId: 'ws-1',
        repository
      })
    }).recoverWorkspace();

    const queuedRun = recovered.runs.find((run) => run.id === 'run-queued-1');
    const runningRun = recovered.runs.find((run) => run.id === 'run-running-1');
    expect(queuedRun?.status).toBe('failed');
    expect(runningRun?.status).toBe('failed');
    expect(queuedRun?.tailLog).toContain('last 4kb');
    expect(runningRun?.tailLog).toContain('last 4kb');
    expect(queuedRun?.summary).toContain('Recovered after unclean shutdown');
    expect(runningRun?.summary).toContain('Recovered after unclean shutdown');

    const recoveryAudits = recovered.audits.filter((audit) => audit.eventType === 'run.recovered');
    expect(recoveryAudits).toHaveLength(2);
    expect(recoveryAudits.map((audit) => audit.runId)).toEqual(
      expect.arrayContaining(['run-queued-1', 'run-running-1'])
    );
  });

  it('is idempotent and does not append duplicate recovery audits', async () => {
    repository.saveRun({
      id: 'run-1',
      workspaceId: 'ws-1',
      nodeId: 'terminal-1',
      runtime: 'shell',
      command: 'echo hello',
      status: 'running',
      summary: null,
      tailLog: 'hello\n',
      createdAtMs: 1,
      startedAtMs: 2,
      completedAtMs: null
    });

    const recoveryService = createRecoveryService({
      workspaceId: 'ws-1',
      repository,
      auditLog: createAuditLog({
        workspaceId: 'ws-1',
        repository
      })
    });

    const firstRecovery = recoveryService.recoverWorkspace();
    const secondRecovery = recoveryService.recoverWorkspace();

    const firstAudits = firstRecovery.audits.filter((audit) => audit.eventType === 'run.recovered');
    const secondAudits = secondRecovery.audits.filter((audit) => audit.eventType === 'run.recovered');
    expect(firstAudits).toHaveLength(1);
    expect(secondAudits).toHaveLength(1);
    expect(secondAudits[0].runId).toBe('run-1');
  });
});
