import { IconButton } from './IconButton';
import { useI18n } from '../../i18n/provider';

interface WorkbenchInspectorProps {
  workspaceName: string | null;
  workspaceRootDir: string | null;
  selectedNode?: {
    id: string;
    title: string;
    componentType: string;
    capabilities: string[];
  } | null;
  nodeCount?: number;
  edgeCount?: number;
  recentAction?: string | null;
  onToggle?: () => void;
}

export const WorkbenchInspector = ({
  workspaceName,
  workspaceRootDir,
  selectedNode = null,
  nodeCount = 0,
  edgeCount = 0,
  recentAction = null,
  onToggle
}: WorkbenchInspectorProps): JSX.Element => {
  const { t } = useI18n();
  const icon = (path: string): JSX.Element => (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d={path} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
  const focusLabel = selectedNode
    ? t('inspector.focusNode')
    : workspaceName
      ? t('inspector.focusWorkspace')
      : t('inspector.focusIdle');

  return (
    <aside className="ow-workbench-inspector" data-testid="workbench-inspector">
      <div className="ow-workbench-inspector__header">
        <IconButton
          icon={icon('M9 18l6-6-6-6')}
          label={t('inspector.collapse')}
          onClick={onToggle}
          testId="workbench-inspector-toggle"
        />
        <div>
          <p className="ow-workbench-inspector__eyebrow">{t('inspector.title')}</p>
          <h2 className="ow-workbench-inspector__title">
            {selectedNode?.title ?? workspaceName ?? t('inspector.nothingSelected')}
          </h2>
        </div>
      </div>

      <div className="ow-workbench-inspector__body">
        <div className="ow-workbench-inspector__summary">
          <article className="ow-workbench-inspector__summary-card">
            <span>{t('inspector.focus')}</span>
            <strong>{focusLabel}</strong>
          </article>
          <article className="ow-workbench-inspector__summary-card">
            <span>{t('inspector.lastChange')}</span>
            <strong>{recentAction ?? t('inspector.noActions')}</strong>
          </article>
        </div>

        <section className="ow-workbench-inspector__section">
          <h3>{t('inspector.selectedNode')}</h3>
          {selectedNode ? (
            <>
              <p>{selectedNode.title}</p>
              <code>{selectedNode.componentType}</code>
              <div className="ow-workbench-inspector__capabilities">
                {selectedNode.capabilities.map((capability) => (
                  <span key={capability}>{capability}</span>
                ))}
              </div>
            </>
          ) : (
            <p>
              {workspaceName
                ? t('inspector.pickNode')
                : t('inspector.pickWorkspace')}
            </p>
          )}
        </section>

        <section className="ow-workbench-inspector__section">
          <h3>{t('inspector.canvasSummary')}</h3>
          <div className="ow-workbench-inspector__stats">
            <div>
              <span>{t('inspector.nodes')}</span>
              <strong>{nodeCount}</strong>
            </div>
            <div>
              <span>{t('inspector.edges')}</span>
              <strong>{edgeCount}</strong>
            </div>
          </div>
          <p>{recentAction ?? t('inspector.noRecentActions')}</p>
        </section>

        <section className="ow-workbench-inspector__section">
          <h3>{t('inspector.workspaceRoot')}</h3>
          <code>{workspaceRootDir ?? t('inspector.awaitingWorkspace')}</code>
        </section>

        <section className="ow-workbench-inspector__section">
          <h3>{t('inspector.quickActions')}</h3>
          <div className="ow-workbench-inspector__quick-actions">
            <span>{t('inspector.quickAdd')}</span>
            <span>{t('inspector.commandPalette')}</span>
            <span>{t('inspector.toggleInspector')}</span>
          </div>
        </section>
      </div>
    </aside>
  );
};
