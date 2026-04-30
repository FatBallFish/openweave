import { describe, expect, it } from 'vitest';
import { toPortalPartitionId } from '../../../src/main/portal/portal-manager';

describe('portal manager partition id', () => {
  it('uses one persistent portal browser profile across portal nodes', () => {
    const first = toPortalPartitionId('a:b-c');
    const second = toPortalPartitionId('a-b:c');

    expect(first).toBe('persist:openweave-portal');
    expect(second).toBe(first);
  });

  it('is stable for the same portal id', () => {
    const portalId = 'workspace-1:portal-1';

    expect(toPortalPartitionId(portalId)).toBe(toPortalPartitionId(portalId));
  });
});
