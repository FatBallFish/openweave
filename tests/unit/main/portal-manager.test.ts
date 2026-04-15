import { describe, expect, it } from 'vitest';
import { toPortalPartitionId } from '../../../src/main/portal/portal-manager';

describe('portal manager partition id', () => {
  it('does not collide for known sanitize collision pair', () => {
    const first = toPortalPartitionId('a:b-c');
    const second = toPortalPartitionId('a-b:c');

    expect(first).not.toBe(second);
  });

  it('is stable for the same portal id', () => {
    const portalId = 'workspace-1:portal-1';

    expect(toPortalPartitionId(portalId)).toBe(toPortalPartitionId(portalId));
  });
});
