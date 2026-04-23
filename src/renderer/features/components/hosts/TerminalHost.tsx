import { canvasStore } from '../../canvas/canvas.store';
import { TerminalNode } from '../../canvas/nodes/TerminalNode';
import type { TerminalConfig } from '../../canvas/nodes/TerminalNode';
import { resolveBuiltinNodeState } from '../host-shell/node-state';
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
    <article
      className="ow-builtin-node-frame ow-terminal-host"
      data-node-kind="terminal"
      data-node-state={state}
      data-testid={`builtin-node-frame-${node.id}`}
    >
      <header className="ow-terminal-host__header" data-testid={`builtin-node-header-${node.id}`}>
        <div className="ow-terminal-host__traffic-lights">
          <span className="ow-terminal-host__light ow-terminal-host__light--close" />
          <span className="ow-terminal-host__light ow-terminal-host__light--minimize" />
          <span className="ow-terminal-host__light ow-terminal-host__light--maximize" />
        </div>
        <span className="ow-terminal-host__title">{node.title}</span>
        <span className="ow-terminal-host__spacer" />
      </header>
      <div className="ow-terminal-host__body">
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
      </div>
    </article>
  );
};
