import { describe, expect, it } from 'vitest';
import {
  createPortalSessionService,
  toPortalSessionId
} from '../../../src/main/portal/portal-session-service';

describe('portal session service', () => {
  it('creates, updates, lists, deletes, and clears portal sessions', () => {
    let now = 100;
    const service = createPortalSessionService({
      now: () => now
    });

    const created = service.upsertSession({
      workspaceId: 'ws-1',
      nodeId: 'portal-1',
      url: 'https://example.com/demo'
    });
    now = 200;
    const updated = service.upsertSession({
      workspaceId: 'ws-1',
      nodeId: 'portal-1',
      url: 'https://example.com/updated'
    });
    service.upsertSession({
      workspaceId: 'ws-2',
      nodeId: 'portal-2',
      url: 'https://example.com/other'
    });

    expect(toPortalSessionId('ws-1', 'portal-1')).toBe('ws-1:portal-1');
    expect(created.createdAtMs).toBe(100);
    expect(updated.createdAtMs).toBe(100);
    expect(updated.updatedAtMs).toBe(200);
    expect(service.getSession('ws-1:portal-1')?.url).toBe('https://example.com/updated');
    expect(service.listWorkspaceSessions('ws-1')).toHaveLength(1);

    service.deleteWorkspaceSessions('ws-1');
    expect(service.getSession('ws-1:portal-1')).toBeNull();

    service.clear();
    expect(service.listWorkspaceSessions('ws-2')).toEqual([]);
  });
});
