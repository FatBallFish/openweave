import { canvasStore } from '../../canvas/canvas.store';
import { getTerminalRuntimeLabel, TerminalNode } from '../../canvas/nodes/TerminalNode';
import type { TerminalConfig } from '../../canvas/nodes/TerminalNode';
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

  const config: TerminalConfig = {
    workingDir: typeof node.config.workingDir === 'string' ? node.config.workingDir : workspaceRootDir,
    iconKey: typeof node.config.iconKey === 'string' ? node.config.iconKey : '',
    iconColor: typeof node.config.iconColor === 'string' ? node.config.iconColor : '',
    theme: node.config.theme === 'light' || node.config.theme === 'dark' ? node.config.theme : 'auto',
    fontFamily: typeof node.config.fontFamily === 'string' ? node.config.fontFamily : '',
    fontSize: typeof node.config.fontSize === 'number' ? node.config.fontSize : 14,
    roleId: typeof node.config.roleId === 'string' ? node.config.roleId : null
  };

  return (
    <BuiltinNodeFrame
      footer={[
        `cwd ${config.workingDir || workspaceRootDir}`,
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
        config={config}
        onChange={(patch) => {
          void canvasStore.updateTerminalNode(node.id, patch);
        }}
        onOpenRun={onOpenRun}
      />
    </BuiltinNodeFrame>
  );
};
