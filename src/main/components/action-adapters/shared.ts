import type { GraphSnapshotV2Input } from '../../../shared/ipc/schemas';

export const createNodeActionNotSupportedError = (): Error => new Error('NODE_ACTION_NOT_SUPPORTED');

export const isSupportedReadMode = (mode?: string): boolean => mode === undefined || mode === 'content';

export const hasCapability = (
  node: GraphSnapshotV2Input['nodes'][number],
  capability: 'read' | 'write'
): boolean => {
  return node.capabilities.includes(capability);
};
