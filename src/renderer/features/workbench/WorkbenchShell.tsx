import type { ReactNode } from 'react';
import { WorkbenchContextPanel } from './WorkbenchContextPanel';
import { WorkbenchInspector } from './WorkbenchInspector';
import { WorkbenchLeftRail } from './WorkbenchLeftRail';
import { WorkbenchStatusIsland } from './WorkbenchStatusIsland';
import { WorkbenchTopBar } from './WorkbenchTopBar';

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
  inspectorCollapsed: boolean;
  onAddTerminal: () => void;
  onAddNote: () => void;
  onAddPortal: () => void;
  onAddFileTree: () => void;
  onAddText: () => void;
  onOpenCommandMenu: () => void;
  onFitCanvas: () => void;
  onOpenSettings: () => void;
  onToggleInspector: () => void;
  searchDisabled: boolean;
  commandMenuDisabled: boolean;
  fitViewDisabled: boolean;
  settingsDisabled: boolean;
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
  inspectorCollapsed,
  onAddTerminal,
  onAddNote,
  onAddPortal,
  onAddFileTree,
  onAddText,
  onOpenCommandMenu,
  onFitCanvas,
  onOpenSettings,
  onToggleInspector,
  searchDisabled,
  commandMenuDisabled,
  fitViewDisabled,
  settingsDisabled
}: WorkbenchShellProps): JSX.Element => {
  const hasActiveWorkspace = workspaceName !== null;
  const statusLabel = !hasActiveWorkspace ? 'Idle' : selectedNode ? 'Focused' : 'Ready';

  return (
    <main className="ow-workbench-shell" data-testid="workbench-shell">
      <WorkbenchTopBar
        disabled={disabled}
        onAddTerminal={onAddTerminal}
        onAddNote={onAddNote}
        onAddPortal={onAddPortal}
        onAddFileTree={onAddFileTree}
        onAddText={onAddText}
        searchDisabled={searchDisabled}
        commandMenuDisabled={commandMenuDisabled}
        fitViewDisabled={fitViewDisabled}
        onOpenCommandMenu={onOpenCommandMenu}
        onFitCanvas={onFitCanvas}
        onOpenSettings={onOpenSettings}
        settingsDisabled={settingsDisabled}
        workspaceName={workspaceName}
      />

      <div className={`ow-workbench-layout${inspectorCollapsed ? ' is-inspector-collapsed' : ''}`}>
        <WorkbenchLeftRail />
        <WorkbenchContextPanel workspaceName={workspaceName}>{contextPanel}</WorkbenchContextPanel>
        <section className="ow-workbench-stage-region" data-testid="workbench-stage-region">
          <div className="ow-workbench-stage" data-testid="workbench-stage">
            {stage}
          </div>
        </section>
        <WorkbenchInspector
          collapsed={inspectorCollapsed}
          edgeCount={edgeCount}
          nodeCount={nodeCount}
          onToggle={onToggleInspector}
          recentAction={recentAction}
          selectedNode={selectedNode}
          workspaceName={workspaceName}
          workspaceRootDir={workspaceRootDir}
        />
      </div>

      <WorkbenchStatusIsland
        eventsCount={recentAction ? 1 : 0}
        hasActiveWorkspace={hasActiveWorkspace}
        statusLabel={statusLabel}
        tasksCount={nodeCount}
      />
      {commandPalette}
    </main>
  );
};
