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
  it('marks running runs as failed after an unclean shutdown and preserves the tail log', async () => {
    repository.saveRun({
      id: 'run-1',
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

    expect(recovered.runs[0].status).toBe('failed');
    expect(recovered.runs[0].tailLog).toContain('last 4kb');
    expect(recovered.runs[0].summary).toContain('Recovered after unclean shutdown');

    expect(recovered.audits[0].eventType).toBe('run.recovered');
    expect(recovered.audits[0].runId).toBe('run-1');
  });
});
