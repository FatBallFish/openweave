import { IconButton } from './IconButton';
import { useI18n } from '../../i18n/provider';

interface WorkbenchTopBarProps {
  disabled: boolean;
  commandMenuDisabled: boolean;
  quickAddDisabled: boolean;
  fitViewDisabled: boolean;
  inspectorDisabled: boolean;
  onAddTerminal: () => void;
  onAddNote: () => void;
  onAddPortal: () => void;
  onAddFileTree: () => void;
  onAddText: () => void;
  onOpenCommandMenu: () => void;
  onOpenQuickAdd: () => void;
  onFitCanvas: () => void;
  onToggleInspector: () => void;
}

export const WorkbenchTopBar = ({
  disabled,
  commandMenuDisabled,
  quickAddDisabled,
  fitViewDisabled,
  inspectorDisabled,
  onAddTerminal,
  onAddNote,
  onAddPortal,
  onAddFileTree,
  onAddText,
  onOpenCommandMenu,
  onOpenQuickAdd,
  onFitCanvas,
  onToggleInspector
}: WorkbenchTopBarProps): JSX.Element => {
  const { t } = useI18n();
  const icon = (path: string, viewBox = '0 0 24 24'): JSX.Element => (
    <svg aria-hidden="true" viewBox={viewBox}>
      <path d={path} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );

  return (
    <div className="ow-workbench-topbar" data-testid="workbench-topbar">
      <div
        className="ow-workbench-topbar__action-cluster ow-workbench-topbar__action-cluster--create"
        data-testid="workbench-topbar-create-cluster"
      >
        <span className="ow-workbench-topbar__cluster-label">{t('topbar.clusterCreate')}</span>
        <IconButton
          disabled={disabled}
          icon={icon('M4 6h16M4 12h8M4 18h16M17 10l3 2-3 2')}
          label={t('topbar.addTerminal')}
          onClick={onAddTerminal}
          primary={true}
          testId="workbench-topbar-action-add-terminal"
        />
        <IconButton
          disabled={disabled}
          icon={icon('M6 5h12v14H6zM9 9h6M9 13h6')}
          label={t('topbar.addNote')}
          onClick={onAddNote}
          primary={true}
          testId="workbench-topbar-action-add-note"
        />
        <IconButton
          disabled={disabled}
          icon={icon('M4 12h16M12 4v16')}
          label={t('topbar.addPortal')}
          onClick={onAddPortal}
          primary={true}
          testId="workbench-topbar-action-add-portal"
        />
        <IconButton
          disabled={disabled}
          icon={icon('M4 7h16M4 12h16M4 17h10')}
          label={t('topbar.addFileTree')}
          onClick={onAddFileTree}
          primary={true}
          testId="workbench-topbar-action-add-file-tree"
        />
        <IconButton
          disabled={disabled}
          icon={icon('M7 6h10M7 12h10M7 18h6')}
          label={t('topbar.addText')}
          onClick={onAddText}
          primary={true}
          testId="workbench-topbar-action-add-text"
        />
      </div>

      <div
        className="ow-workbench-topbar__action-cluster ow-workbench-topbar__action-cluster--utility"
        data-testid="workbench-topbar-canvas-cluster"
      >
        <span className="ow-workbench-topbar__cluster-label">{t('topbar.clusterCanvas')}</span>
        <IconButton
          disabled={commandMenuDisabled}
          icon={icon('M5 7h14M5 12h14M5 17h10')}
          label={t('topbar.commandMenu')}
          onClick={onOpenCommandMenu}
          testId="workbench-topbar-action-command-menu"
        />
        <IconButton
          disabled={quickAddDisabled}
          icon={icon('M12 5v14M5 12h14')}
          label={t('topbar.quickAdd')}
          onClick={onOpenQuickAdd}
          testId="workbench-topbar-action-quick-add"
        />
        <IconButton
          disabled={fitViewDisabled}
          icon={icon('M8 4H4v4M20 8V4h-4M4 16v4h4M16 20h4v-4')}
          label={t('topbar.fitView')}
          onClick={onFitCanvas}
          testId="workbench-topbar-action-fit-view"
        />
        <IconButton
          disabled={inspectorDisabled}
          icon={icon('M9 4h11v16H9M4 8h1M4 12h1M4 16h1')}
          label={t('topbar.toggleInspector')}
          onClick={onToggleInspector}
          testId="workbench-topbar-action-toggle-inspector"
        />
      </div>
    </div>
  );
};
