import type { ReactNode } from 'react';

interface WorkbenchContextPanelProps {
  workspaceName: string | null;
  children: ReactNode;
}

const resourceStarters = [
  { name: 'Terminal', detail: 'Launch an agent runtime' },
  { name: 'Note', detail: 'Keep markdown plans nearby' },
  { name: 'Portal', detail: 'Verify against live web context' },
  { name: 'File tree', detail: 'Browse repo structure quickly' },
  { name: 'Text', detail: 'Pin read-only outputs and evidence' }
] as const;

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

      <section className="ow-workbench-context-panel__resources" data-testid="workbench-resource-starters">
        {resourceStarters.map((resource) => (
          <article key={resource.name} className="ow-workbench-context-panel__resource-card">
            <strong>{resource.name}</strong>
            <p>{resource.detail}</p>
          </article>
        ))}
      </section>

      <div className="ow-workbench-context-panel__body">{children}</div>
    </section>
  );
};
