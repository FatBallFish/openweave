import type { ReactNode } from 'react';

interface WorkbenchContextPanelProps {
  workspaceName: string | null;
  children: ReactNode;
}

const resourceStarters = [
  { code: 'TR', name: 'Terminal', detail: 'Launch an agent runtime', meta: 'Exec + logs' },
  { code: 'NT', name: 'Note', detail: 'Keep markdown plans nearby', meta: 'Plans + drafts' },
  { code: 'PT', name: 'Portal', detail: 'Verify against live web context', meta: 'Browser control' },
  { code: 'FT', name: 'File tree', detail: 'Browse repo structure quickly', meta: 'Repo context' },
  { code: 'TX', name: 'Text', detail: 'Pin read-only outputs and evidence', meta: 'Pinned evidence' }
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

      <div className="ow-workbench-context-panel__summary">
        <article className="ow-workbench-context-panel__summary-card">
          <span>Status</span>
          <strong>{workspaceName ? 'Registry attached' : 'Awaiting workspace'}</strong>
        </article>
        <article className="ow-workbench-context-panel__summary-card">
          <span>Surface</span>
          <strong>Canvas orchestration</strong>
        </article>
      </div>

      <section className="ow-workbench-context-panel__resources" data-testid="workbench-resource-starters">
        {resourceStarters.map((resource) => (
          <article key={resource.name} className="ow-workbench-context-panel__resource-card">
            <div className="ow-workbench-context-panel__resource-header">
              <span className="ow-workbench-context-panel__resource-code">{resource.code}</span>
              <strong>{resource.name}</strong>
            </div>
            <p>{resource.detail}</p>
            <span className="ow-workbench-context-panel__resource-meta">{resource.meta}</span>
          </article>
        ))}
      </section>

      <div className="ow-workbench-context-panel__body">{children}</div>
    </section>
  );
};
