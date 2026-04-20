import { canvasStore } from '../../canvas/canvas.store';
import {
  getTerminalRuntimeLabel,
  TerminalNode
} from '../../canvas/nodes/TerminalNode';
import { BuiltinNodeFrame } from '../host-shell/BuiltinNodeFrame';
import { getBuiltinNodeStateLabel, resolveBuiltinNodeState } from '../host-shell/node-state';
import type { BuiltinHostProps } from './types';

export const TerminalHost = ({
  workspaceId,
  workspaceRootDir,
  node,
  onOpenRun
}: BuiltinHostProps): JSX.Element => {
  const state = resolveBuiltinNodeState(node);
  const runtime =
    node.config.runtime === 'codex' ||
    node.config.runtime === 'claude' ||
    node.config.runtime === 'opencode'
      ? node.config.runtime
      : 'shell';

  return (
    <BuiltinNodeFrame
      footer={[
        `cwd ${workspaceRootDir}`,
        `Runtime ${getTerminalRuntimeLabel(runtime)}`,
        'Session drawer linked'
      ]}
      iconLabel="TR"
      kind="terminal"
      nodeId={node.id}
      state={state}
      stateLabel={getBuiltinNodeStateLabel(state)}
      subtitle="Session-first execution"
      title={node.title}
    >
      <TerminalNode
        workspaceId={workspaceId}
        node={{
          id: node.id,
          type: 'terminal',
          x: node.bounds.x,
          y: node.bounds.y,
          command: typeof node.config.command === 'string' ? node.config.command : '',
          runtime
        }}
        onChange={(patch) => {
          void canvasStore.updateTerminalNode(node.id, patch);
        }}
        onOpenRun={onOpenRun}
      />
    </BuiltinNodeFrame>
  );
};
