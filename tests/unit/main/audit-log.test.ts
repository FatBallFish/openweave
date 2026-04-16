import { describe, expect, it, vi } from 'vitest';
import { createAuditLog } from '../../../src/main/audit/audit-log';

describe('audit log', () => {
  it('persists audit log records with deterministic ids, timestamps, and default null run ids', () => {
    const appendAuditLog = vi.fn((record) => record);
    const auditLog = createAuditLog({
      workspaceId: 'ws-1',
      repository: {
        appendAuditLog
      } as never,
      now: () => 123,
      randomId: () => 'audit-1'
    });

    const persisted = auditLog.persist({
      eventType: 'run.finished',
      status: 'completed',
      message: 'done'
    });

    expect(appendAuditLog).toHaveBeenCalledWith({
      id: 'audit-1',
      workspaceId: 'ws-1',
      eventType: 'run.finished',
      runId: null,
      status: 'completed',
      message: 'done',
      createdAtMs: 123
    });
    expect(persisted).toMatchObject({
      id: 'audit-1',
      workspaceId: 'ws-1',
      eventType: 'run.finished',
      runId: null
    });
  });
});
