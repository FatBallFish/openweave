import { canvasStore } from '../../canvas/canvas.store';
import { PortalNode } from '../../canvas/nodes/PortalNode';
import type { BuiltinHostProps } from './types';

export const PortalHost = ({ workspaceId, node }: BuiltinHostProps): JSX.Element => {
  return (
    <PortalNode
      workspaceId={workspaceId}
      node={{
        id: node.id,
        type: 'portal',
        x: node.bounds.x,
        y: node.bounds.y,
        url: typeof node.config.url === 'string' ? node.config.url : 'https://example.com'
      }}
      onChange={(patch) => {
        void canvasStore.updatePortalNode(node.id, patch);
      }}
    />
  );
};
