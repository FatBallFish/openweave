import { useI18n } from '../../i18n/provider';

interface WorkbenchStatusIslandProps {
  hasActiveWorkspace: boolean;
  statusLabel?: string;
  eventsCount?: number;
  tasksCount?: number;
}

export const WorkbenchStatusIsland = ({
  hasActiveWorkspace,
  statusLabel,
  eventsCount = 0,
  tasksCount
}: WorkbenchStatusIslandProps): JSX.Element => {
  const { t } = useI18n();

  return (
    <div className="ow-workbench-status-island" data-testid="workbench-status-island">
      <div
        className="ow-workbench-status-island__item ow-workbench-status-island__item--status"
        data-state={hasActiveWorkspace ? 'active' : 'idle'}
        data-testid="status-island-status"
      >
        <span className="ow-workbench-status-island__label">{t('status.label')}</span>
        <strong className="ow-workbench-status-island__value">
          {statusLabel ?? (hasActiveWorkspace ? t('app.statusReady') : t('app.statusIdle'))}
        </strong>
      </div>
      <div className="ow-workbench-status-island__item" data-testid="status-island-events">
        <span className="ow-workbench-status-island__label">{t('status.events')}</span>
        <strong className="ow-workbench-status-island__value">{eventsCount}</strong>
      </div>
      <div className="ow-workbench-status-island__item" data-testid="status-island-tasks">
        <span className="ow-workbench-status-island__label">{t('status.tasks')}</span>
        <strong className="ow-workbench-status-island__value">
          {tasksCount ?? (hasActiveWorkspace ? 1 : 0)}
        </strong>
      </div>
    </div>
  );
};
