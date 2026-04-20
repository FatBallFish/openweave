import { canvasStore } from '../../canvas/canvas.store';
import { PortalNode } from '../../canvas/nodes/PortalNode';
import { BuiltinNodeFrame } from '../host-shell/BuiltinNodeFrame';
import { getBuiltinNodeStateLabel, resolveBuiltinNodeState } from '../host-shell/node-state';
import type { BuiltinHostProps } from './types';

const getPortalDomainLabel = (url: string): string => {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
};

export const PortalHost = ({ workspaceId, node }: BuiltinHostProps): JSX.Element => {
  const state = resolveBuiltinNodeState(node);
  const url = typeof node.config.url === 'string' ? node.config.url : 'https://example.com';

  return (
    <BuiltinNodeFrame
      footer={[
        `Domain ${getPortalDomainLabel(url)}`,
        'Open page and capture',
        'Read structure quickly'
      ]}
      iconLabel="PT"
      nodeId={node.id}
      state={state}
      stateLabel={getBuiltinNodeStateLabel(state)}
      subtitle="Controlled field instrument"
      title={node.title}
    >
      <PortalNode
        workspaceId={workspaceId}
        node={{
          id: node.id,
          type: 'portal',
          x: node.bounds.x,
          y: node.bounds.y,
          url
        }}
        onChange={(patch) => {
          void canvasStore.updatePortalNode(node.id, patch);
        }}
      />
    </BuiltinNodeFrame>
  );
};
