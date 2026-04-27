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
  connectModeActive?: boolean;
  onToggleConnectMode?: () => void;
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
  onTogglePlacement,
  connectModeActive,
  onToggleConnectMode,
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
          icon={icon('M4 5h16v14H4z M7 10l3 3-3 3 M12 16h3')}
          label={t('topbar.addTerminal')}
          onClick={() => onTogglePlacement?.('terminal')}
          primary={true}
          active={activePlacementType === 'terminal'}
          testId="workbench-topbar-action-add-terminal"
        />
        <IconButton
          disabled={disabled}
          icon={icon('M7 3h10l4 4v14H7z M9 10h8M9 14h8M9 18h5')}
          label={t('topbar.addNote')}
          onClick={() => onTogglePlacement?.('note')}
          primary={true}
          active={activePlacementType === 'note'}
          testId="workbench-topbar-action-add-note"
        />
        <IconButton
          disabled={disabled}
          icon={icon('M12 2a10 10 0 100 20 10 10 0 000-20z M2 12h20 M12 2a5 8 0 010 20')}
          label={t('topbar.addPortal')}
          onClick={() => onTogglePlacement?.('portal')}
          primary={true}
          active={activePlacementType === 'portal'}
          testId="workbench-topbar-action-add-portal"
        />
        <IconButton
          disabled={disabled}
          icon={icon('M2 6h8l2 2h10v10H2z')}
          label={t('topbar.addFileTree')}
          onClick={() => onTogglePlacement?.('file-tree')}
          primary={true}
          active={activePlacementType === 'file-tree'}
          testId="workbench-topbar-action-add-file-tree"
        />
        <IconButton
          disabled={disabled}
          icon={icon('M5 5h14M5 10h14M5 15h10M5 20h12')}
          label={t('topbar.addText')}
          onClick={() => onTogglePlacement?.('text')}
          primary={true}
          active={activePlacementType === 'text'}
          testId="workbench-topbar-action-add-text"
        />

        <div
          style={{ width: 1, height: 28, background: "var(--ow-color-border)", margin: "0 6px", flexShrink: 0 }}
        />

        <IconButton
          disabled={disabled}
          icon={
            <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15">
              <circle cx="6" cy="6" r="1.6" fill="currentColor" stroke="none" />
              <circle cx="18" cy="18" r="1.6" fill="currentColor" stroke="none" />
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 3" />
            </svg>
          }
          label={t("topbar.addConnect")}
          onClick={onToggleConnectMode}
          primary={true}
          active={connectModeActive ?? false}
          testId="workbench-topbar-action-connect"
        />
      </div>

      {/* Utility cluster removed: command menu, quick add, fit view, toggle inspector
         are now accessible via keyboard shortcuts and the command palette */}
    </div>
  );
};
