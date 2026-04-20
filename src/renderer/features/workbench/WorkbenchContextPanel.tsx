import type { ReactNode } from 'react';

interface WorkbenchContextPanelProps {
  workspaceName: string | null;
  children: ReactNode;
}

export const WorkbenchContextPanel = ({
  workspaceName,
  children
}: WorkbenchContextPanelProps): JSX.Element => {
  return (
    <section className="ow-workbench-context-panel" data-testid="workbench-context-panel">
      <header className="ow-workbench-context-panel__header">
        <div>
          <p className="ow-workbench-context-panel__eyebrow">Workspace Registry</p>
          <h2 className="ow-workbench-context-panel__title">{workspaceName ?? 'Choose a workspace'}</h2>
        </div>
        <div className="ow-workbench-context-panel__badge">Context + resources</div>
      </header>
      <div className="ow-workbench-context-panel__body">{children}</div>
    </section>
  );
};
