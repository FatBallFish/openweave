import { useI18n } from '../../i18n/provider';

interface WorkbenchLeftRailProps {
  contextPanelCollapsed: boolean;
  onToggleContextPanel: () => void;
  onFitCanvas: () => void;
  onOpenCommandMenu: () => void;
  onOpenQuickAdd: () => void;
  onToggleInspector: () => void;
  onOpenSettings: () => void;
}

type RailAction = {
  id: string;
  label: string;
  active?: boolean;
  onClick: () => void;
  path: string;
};

export const WorkbenchLeftRail = ({
  contextPanelCollapsed,
  onToggleContextPanel,
  onFitCanvas,
  onOpenCommandMenu,
  onOpenQuickAdd,
  onToggleInspector,
  onOpenSettings
}: WorkbenchLeftRailProps): JSX.Element => {
  const { t } = useI18n();
  const renderIcon = (path: string): JSX.Element => (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d={path} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );

  const actions: RailAction[] = [
    {
      id: 'workspace',
      label: t('leftRail.workspace'),
      active: !contextPanelCollapsed,
      onClick: onToggleContextPanel,
      path: 'M4 7.5h16M4 12h16M4 16.5h10'
    },
    {
      id: 'canvas',
      label: t('leftRail.canvas'),
      onClick: onFitCanvas,
      path: 'M4 12h16M12 4v16M7 7l10 10M17 7L7 17'
    },
    {
      id: 'command-menu',
      label: t('leftRail.commandMenu'),
      onClick: onOpenCommandMenu,
      path: 'M5 7h14M5 12h14M5 17h10'
    },
    {
      id: 'quick-add',
      label: t('leftRail.quickAdd'),
      onClick: onOpenQuickAdd,
      path: 'M12 5v14M5 12h14'
    }
  ];

  return (
    <aside className="ow-workbench-left-rail" data-testid="workbench-left-rail">
      <div className="ow-workbench-left-rail__brand" data-testid="workbench-left-rail-brand">
        <div aria-hidden="true" className="ow-workbench-left-rail__brand-mark">
          OW
        </div>
        <div className="ow-workbench-left-rail__brand-copy">
          <strong>OpenWeave</strong>
          <span>{t('app.subtitle')}</span>
        </div>
      </div>

      <div className="ow-workbench-left-rail__stack">
        {actions.map((item) => (
          <button
            key={item.id}
            aria-label={item.label}
            aria-pressed={item.active ? 'true' : 'false'}
            className={`ow-workbench-left-rail__item${item.active ? ' is-active' : ''}`}
            data-testid={`workbench-left-rail-item-${item.id}`}
            onClick={item.onClick}
            title={item.label}
            type="button"
          >
            <span aria-hidden="true" className="ow-workbench-left-rail__glyph">
              {renderIcon(item.path)}
            </span>
          </button>
        ))}
      </div>

      <div className="ow-workbench-left-rail__footer">
        <button
          aria-label={t('leftRail.toggleInspector')}
          className="ow-workbench-left-rail__item"
          data-testid="workbench-left-rail-item-toggle-inspector"
          onClick={onToggleInspector}
          title={t('leftRail.toggleInspector')}
          type="button"
        >
          <span aria-hidden="true" className="ow-workbench-left-rail__glyph">
            {renderIcon('M9 4h11v16H9M4 8h1M4 12h1M4 16h1')}
          </span>
        </button>
        <button
          aria-label={t('topbar.settings')}
          className="ow-workbench-left-rail__item"
          data-testid="workbench-left-rail-item-settings"
          onClick={onOpenSettings}
          title={t('topbar.settings')}
          type="button"
        >
          <span aria-hidden="true" className="ow-workbench-left-rail__glyph">
            {renderIcon('M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z')}
          </span>
        </button>
      </div>
    </aside>
  );
};
