import type { ReactNode } from 'react';
import { NoteToolbar } from '../canvas/NoteToolbar';
import { WorkbenchContextPanel } from './WorkbenchContextPanel';
import { WorkbenchInspector } from './WorkbenchInspector';
import { WorkbenchStatusIsland } from './WorkbenchStatusIsland';
import { WorkbenchTopBar } from './WorkbenchTopBar';
import { useI18n } from '../../i18n/provider';

export interface WorkbenchSelectedNode {
  id: string;
  title: string;
  componentType: string;
  capabilities: string[];
}

interface WorkbenchShellProps {
  workspaceName: string | null;
  workspaceRootDir: string | null;
  contextPanel: ReactNode;
  stage: ReactNode;
  commandPalette?: ReactNode;
  disabled: boolean;
  selectedNode: WorkbenchSelectedNode | null;
  nodeCount: number;
  edgeCount: number;
  recentAction: string | null;
  contextPanelCollapsed: boolean;
  inspectorCollapsed: boolean;
  onAddTerminal: () => void;
  onAddNote: () => void;
  onAddPortal: () => void;
  onAddFileTree: () => void;
  onAddText: () => void;
  onOpenCommandMenu: () => void;
  onOpenQuickAdd: () => void;
  onFitCanvas: () => void;
  onToggleContextPanel: () => void;
  onToggleInspector: () => void;
  onOpenSettings: () => void;
  commandMenuDisabled: boolean;
  quickAddDisabled: boolean;
  fitViewDisabled: boolean;
  inspectorDisabled: boolean;
  activePlacementType?: string | null;
  onTogglePlacement?: (type: string) => void;
}

export const WorkbenchShell = ({
  workspaceName,
  workspaceRootDir,
  contextPanel,
  stage,
  commandPalette,
  disabled,
  selectedNode,
  nodeCount,
  edgeCount,
  recentAction,
  contextPanelCollapsed,
  inspectorCollapsed,
  onAddTerminal,
  onAddNote,
  onAddPortal,
  onAddFileTree,
  onAddText,
  onOpenCommandMenu,
  onOpenQuickAdd,
  onFitCanvas,
  onToggleContextPanel,
  onToggleInspector,
  onOpenSettings,
  commandMenuDisabled,
  quickAddDisabled,
  fitViewDisabled,
  inspectorDisabled,
  activePlacementType,
  onTogglePlacement
}: WorkbenchShellProps): JSX.Element => {
  const { t } = useI18n();
  const hasActiveWorkspace = workspaceName !== null;
  const statusLabel = !hasActiveWorkspace
    ? t('app.statusIdle')
    : selectedNode
      ? t('app.statusFocused')
      : t('app.statusReady');

  return (
    <main className="ow-workbench-shell" data-testid="workbench-shell">
      <section className="ow-workbench-shell__overlay-stage" data-testid="workbench-overlay-stage">
        {contextPanelCollapsed ? (
          <button
            aria-label={t('inspector.expand')}
            className="ow-workbench-expand-trigger"
            data-testid="workbench-expand-trigger"
            onClick={onToggleContextPanel}
            title={t('inspector.expand')}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
              <path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
        ) : null}
        {inspectorCollapsed ? (
          <button
            aria-label={t('inspector.expand')}
            className="ow-workbench-inspector-expand-trigger"
            data-testid="workbench-inspector-expand-trigger"
            onClick={onToggleInspector}
            title={t('inspector.expand')}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
              <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
        ) : null}
        <div className="ow-workbench-stage" data-testid="workbench-stage">
          {stage}
        </div>
      </section>

      <div
        className={`ow-workbench-shell__chrome${inspectorCollapsed ? ' is-inspector-collapsed' : ''}${
          contextPanelCollapsed ? ' is-context-collapsed' : ''
        }`}
      >
        <WorkbenchTopBar
          disabled={disabled}
          onAddTerminal={onAddTerminal}
          onAddNote={onAddNote}
          onAddPortal={onAddPortal}
          onAddFileTree={onAddFileTree}
          onAddText={onAddText}
          commandMenuDisabled={commandMenuDisabled}
          quickAddDisabled={quickAddDisabled}
          fitViewDisabled={fitViewDisabled}
          onOpenCommandMenu={onOpenCommandMenu}
          onOpenQuickAdd={onOpenQuickAdd}
          onFitCanvas={onFitCanvas}
          onToggleInspector={onToggleInspector}
          inspectorDisabled={inspectorDisabled}
          activePlacementType={activePlacementType}
          onTogglePlacement={onTogglePlacement}
        />
        <NoteToolbar />
        <WorkbenchContextPanel
          workspaceName={workspaceName}
          collapsed={contextPanelCollapsed}
          onOpenSettings={onOpenSettings}
        >
          {contextPanel}
        </WorkbenchContextPanel>
        <WorkbenchInspector
          edgeCount={edgeCount}
          nodeCount={nodeCount}
          onToggle={onToggleInspector}
          recentAction={recentAction}
          selectedNode={selectedNode}
          workspaceName={workspaceName}
          workspaceRootDir={workspaceRootDir}
        />
        <WorkbenchStatusIsland
          eventsCount={recentAction ? 1 : 0}
          hasActiveWorkspace={hasActiveWorkspace}
          statusLabel={statusLabel}
          tasksCount={nodeCount}
        />
      </div>
      {commandPalette}
    </main>
  );
};
