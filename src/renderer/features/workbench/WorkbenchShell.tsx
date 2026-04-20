import type { ReactNode } from 'react';
import { useState } from 'react';
import { WorkbenchContextPanel } from './WorkbenchContextPanel';
import { WorkbenchInspector } from './WorkbenchInspector';
import { WorkbenchLeftRail } from './WorkbenchLeftRail';
import { WorkbenchStatusIsland } from './WorkbenchStatusIsland';
import { WorkbenchTopBar } from './WorkbenchTopBar';

interface WorkbenchShellProps {
  workspaceName: string | null;
  workspaceRootDir: string | null;
  contextPanel: ReactNode;
  stage: ReactNode;
  disabled: boolean;
  onAddTerminal: () => void;
  onAddNote: () => void;
  onAddPortal: () => void;
  onAddFileTree: () => void;
  onAddText: () => void;
  onOpenCommandMenu: () => void;
  onFitCanvas: () => void;
  onOpenSettings: () => void;
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
  disabled,
  onAddTerminal,
  onAddNote,
  onAddPortal,
  onAddFileTree,
  onAddText,
  onOpenCommandMenu,
  onFitCanvas,
  onOpenSettings,
  searchDisabled,
  commandMenuDisabled,
  fitViewDisabled,
  settingsDisabled
}: WorkbenchShellProps): JSX.Element => {
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const hasActiveWorkspace = workspaceName !== null;

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
          onToggle={() => setInspectorCollapsed((value) => !value)}
          workspaceName={workspaceName}
          workspaceRootDir={workspaceRootDir}
        />
      </div>

      <WorkbenchStatusIsland hasActiveWorkspace={hasActiveWorkspace} />
    </main>
  );
};
