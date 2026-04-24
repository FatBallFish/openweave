import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { canvasStore } from '../../canvas/canvas.store';
import { TerminalNode } from '../../canvas/nodes/TerminalNode';
import type { TerminalConfig } from '../../canvas/nodes/TerminalNode';
import type { RoleRecord } from '../../../shared/ipc/contracts';
import { resolveBuiltinNodeState } from '../host-shell/node-state';
import type { BuiltinHostProps } from './types';
import { WorkspaceGlyph } from '../../workspaces/workspace-icons';
import { useI18n } from '../../../i18n/provider';

export const TerminalHost = ({
  workspaceId,
  workspaceRootDir,
  node,
  onOpenRun
}: BuiltinHostProps): JSX.Element => {
  const { t } = useI18n();
  const state = resolveBuiltinNodeState(node);
  const runtime =
    node.config.runtime === 'codex' ||
    node.config.runtime === 'claude' ||
    node.config.runtime === 'opencode'
      ? node.config.runtime
      : 'shell';

  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const bridge = (window as any).openweaveShell;
        if (!bridge?.roles) return;
        const res = await bridge.roles.listRoles();
        setRoles(res.roles);
      } catch {
        // ignore
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleEdit = useCallback(() => {
    setContextMenu(null);
    window.dispatchEvent(new CustomEvent('openweave:edit-terminal', {
      detail: { nodeId: node.id, config: node.config }
    }));
  }, [node.id, node.config]);

  const handleSimulate = useCallback(() => {
    setContextMenu(null);
    window.dispatchEvent(new CustomEvent('openweave:simulate-node-message', {
      detail: { nodeId: node.id, workspaceId }
    }));
  }, [node.id, workspaceId]);

  const config: TerminalConfig = {
    workingDir: typeof node.config.workingDir === 'string' ? node.config.workingDir : workspaceRootDir,
    projectDir: typeof node.config.projectDir === 'string' ? node.config.projectDir : null,
    iconKey: typeof node.config.iconKey === 'string' ? node.config.iconKey : '',
    iconColor: typeof node.config.iconColor === 'string' ? node.config.iconColor : '',
    theme: node.config.theme === 'light' || node.config.theme === 'dark' ? node.config.theme : 'auto',
    fontFamily: typeof node.config.fontFamily === 'string' ? node.config.fontFamily : '',
    fontSize: typeof node.config.fontSize === 'number' ? node.config.fontSize : 14,
    roleId: typeof node.config.roleId === 'string' ? node.config.roleId : null
  };

  const role = roles.find((r) => r.id === config.roleId) ?? null;

  const menu = contextMenu ? (
    <div
      className="ow-terminal-context-menu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      <button type="button" onClick={handleEdit}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        <span>{t('terminal.contextMenu.edit')}</span>
      </button>
      <button type="button" onClick={handleSimulate}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
        <span>{t('terminal.contextMenu.simulate')}</span>
      </button>
    </div>
  ) : null;

  return (
    <article
      className="ow-builtin-node-frame ow-terminal-host"
      data-node-kind="terminal"
      data-node-state={state}
      data-testid={`builtin-node-frame-${node.id}`}
      onContextMenu={handleContextMenu}
    >
      <header className="ow-terminal-host__header" data-testid={`builtin-node-header-${node.id}`}>
        <div className="ow-terminal-host__traffic-lights">
          <span className="ow-terminal-host__light ow-terminal-host__light--close" />
          <span className="ow-terminal-host__light ow-terminal-host__light--minimize" />
          <span className="ow-terminal-host__light ow-terminal-host__light--maximize" />
        </div>
        <div className="ow-terminal-host__title-area">
          {config.iconKey && (
            <WorkspaceGlyph
              iconKey={config.iconKey}
              color={config.iconColor || undefined}
              size={14}
              className="ow-terminal-host__title-icon"
            />
          )}
          <span className="ow-terminal-host__title">{node.title}</span>
          {role && (
            <span
              className="ow-terminal-host__role-tag"
              style={{ backgroundColor: role.color }}
            >
              {role.icon || '👤'} {role.name}
            </span>
          )}
        </div>
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
      {menu && createPortal(menu, document.body)}
    </article>
  );
};
