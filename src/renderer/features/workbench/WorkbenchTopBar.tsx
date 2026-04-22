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
  activePlacementType?: string | null;
  onTogglePlacement?: (type: string) => void;
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
  onToggleInspector,
  activePlacementType,
  onTogglePlacement
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
          onClick={() => onTogglePlacement?.('terminal')}
          primary={true}
          active={activePlacementType === 'terminal'}
          testId="workbench-topbar-action-add-terminal"
        />
        <IconButton
          disabled={disabled}
          icon={icon('M6 5h12v14H6zM9 9h6M9 13h6')}
          label={t('topbar.addNote')}
          onClick={() => onTogglePlacement?.('note')}
          primary={true}
          active={activePlacementType === 'note'}
          testId="workbench-topbar-action-add-note"
        />
        <IconButton
          disabled={disabled}
          icon={icon('M4 12h16M12 4v16')}
          label={t('topbar.addPortal')}
          onClick={() => onTogglePlacement?.('portal')}
          primary={true}
          active={activePlacementType === 'portal'}
          testId="workbench-topbar-action-add-portal"
        />
        <IconButton
          disabled={disabled}
          icon={icon('M4 7h16M4 12h16M4 17h10')}
          label={t('topbar.addFileTree')}
          onClick={() => onTogglePlacement?.('file-tree')}
          primary={true}
          active={activePlacementType === 'file-tree'}
          testId="workbench-topbar-action-add-file-tree"
        />
        <IconButton
          disabled={disabled}
          icon={icon('M7 6h10M7 12h10M7 18h6')}
          label={t('topbar.addText')}
          onClick={() => onTogglePlacement?.('text')}
          primary={true}
          active={activePlacementType === 'text'}
          testId="workbench-topbar-action-add-text"
        />
      </div>

      {/* Utility cluster removed: command menu, quick add, fit view, toggle inspector
         are now accessible via keyboard shortcuts and the command palette */}
    </div>
  );
};
