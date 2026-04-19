import { canvasStore } from '../../canvas/canvas.store';
import { TerminalNode } from '../../canvas/nodes/TerminalNode';
import type { BuiltinHostProps } from './types';

export const TerminalHost = ({ workspaceId, node, onOpenRun }: BuiltinHostProps): JSX.Element => {
  return (
    <TerminalNode
      workspaceId={workspaceId}
      node={{
        id: node.id,
        type: 'terminal',
        x: node.bounds.x,
        y: node.bounds.y,
        command: typeof node.config.command === 'string' ? node.config.command : '',
        runtime:
          node.config.runtime === 'codex' ||
          node.config.runtime === 'claude' ||
          node.config.runtime === 'opencode'
            ? node.config.runtime
            : 'shell'
      }}
      onChange={(patch) => {
        void canvasStore.updateTerminalNode(node.id, patch);
      }}
      onOpenRun={onOpenRun}
    />
  );
};
