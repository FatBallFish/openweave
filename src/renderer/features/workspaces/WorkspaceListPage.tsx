import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { WorkspaceGroupRecord, WorkspaceRecord } from '../../../shared/ipc/contracts';
import { useI18n } from '../../i18n/provider';
import { BranchWorkspaceDialog } from './BranchWorkspaceDialog';
import { CreateWorkspaceDialog } from './CreateWorkspaceDialog';
import { WorkspaceGlyph } from './workspace-icons';
import { useWorkspacesStore, workspacesStore } from './workspaces.store';

interface WorkspaceListPageProps {
  variant?: 'page' | 'panel';
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface WorkspaceRenderRow {
  workspace: WorkspaceRecord;
  depth: number;
  rootWorkspaceId: string;
}

const toWorkspaceRows = (
  workspaces: WorkspaceRecord[],
  visibleWorkspaceIds: Set<string>,
  filterGroupId: string | null = null
): WorkspaceRenderRow[] => {
  const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  const childrenByParentId = new Map<string, WorkspaceRecord[]>();

  for (const workspace of workspaces) {
    if (!workspace.sourceWorkspaceId) {
      continue;
    }
    const siblings = childrenByParentId.get(workspace.sourceWorkspaceId) ?? [];
    siblings.push(workspace);
    childrenByParentId.set(workspace.sourceWorkspaceId, siblings);
  }

  const orderedWorkspaceIds = workspaces.map((workspace) => workspace.id);
  const orderIndexById = new Map(orderedWorkspaceIds.map((workspaceId, index) => [workspaceId, index]));
  for (const children of childrenByParentId.values()) {
    children.sort(
      (left, right) =>
        (orderIndexById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (orderIndexById.get(right.id) ?? Number.MAX_SAFE_INTEGER)
    );
  }

  const rootWorkspaces = workspaces.filter((workspace) => {
    if (!visibleWorkspaceIds.has(workspace.id)) {
      return false;
    }
    if (workspace.sourceWorkspaceId) {
      return false;
    }
    if (filterGroupId !== null) {
      return workspace.groupId === filterGroupId;
    }
    return !workspace.groupId;
  });

  const rows: WorkspaceRenderRow[] = [];

  const appendWorkspace = (workspace: WorkspaceRecord, depth: number, rootWorkspaceId: string): void => {
    if (!visibleWorkspaceIds.has(workspace.id)) {
      return;
    }

    rows.push({
      workspace,
      depth,
      rootWorkspaceId
    });

    const children = childrenByParentId.get(workspace.id) ?? [];
    for (const childWorkspace of children) {
      appendWorkspace(childWorkspace, depth + 1, rootWorkspaceId);
    }
  };

  for (const rootWorkspace of rootWorkspaces) {
    appendWorkspace(rootWorkspace, 0, rootWorkspace.id);
  }

  return rows;
};

export const WorkspaceListPage = ({
  variant = 'page',
  collapsed,
  onToggleCollapse
}: WorkspaceListPageProps): JSX.Element => {
  const { t } = useI18n();
  const workspaces = useWorkspacesStore((storeState) => storeState.workspaces);
  const groups = useWorkspacesStore((storeState) => storeState.groups);
  const groupUiState = useWorkspacesStore((storeState) => storeState.groupUiState);
  const mountedWorkspaceIds = useWorkspacesStore((storeState) => storeState.mountedWorkspaceIds);
  const activeWorkspaceId = useWorkspacesStore((storeState) => storeState.activeWorkspaceId);
  const loading = useWorkspacesStore((storeState) => storeState.loading);
  const isBranchDialogOpen = useWorkspacesStore((storeState) => storeState.isBranchDialogOpen);
  const branchSourceWorkspaceId = useWorkspacesStore((storeState) => storeState.branchSourceWorkspaceId);
  const errorMessage = useWorkspacesStore((storeState) => storeState.errorMessage);
  const isAddMenuOpen = useWorkspacesStore((storeState) => storeState.isAddMenuOpen);
  const [searchQuery, setSearchQuery] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [workspacePendingDelete, setWorkspacePendingDelete] = useState<WorkspaceRecord | null>(null);
  const [contextMenuState, setContextMenuState] = useState<{
    workspaceId: string;
    x: number;
    y: number;
  } | null>(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupDialogMode, setGroupDialogMode] = useState<'create' | 'edit'>('create');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupPendingDelete, setGroupPendingDelete] = useState<WorkspaceGroupRecord | null>(null);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [groupContextMenuState, setGroupContextMenuState] = useState<{
    groupId: string;
    x: number;
    y: number;
  } | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    targetType: 'ungrouped' | 'group';
    groupId?: string;
    insertIndex: number;
  } | null>(null);
  const [draggedWorkspaceId, setDraggedWorkspaceId] = useState<string | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [addMenuPosition, setAddMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;

  useEffect(() => {
    void workspacesStore.loadWorkspaces();
    void workspacesStore.loadWorkspaceGroups();
  }, []);

  useEffect(() => {
    if (!contextMenuState && !groupContextMenuState) {
      return;
    }

    const closeContextMenu = (): void => {
      setContextMenuState(null);
      setGroupContextMenuState(null);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closeContextMenu();
      }
    };

    window.addEventListener('click', closeContextMenu);
    window.addEventListener('contextmenu', closeContextMenu);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('click', closeContextMenu);
      window.removeEventListener('contextmenu', closeContextMenu);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [contextMenuState, groupContextMenuState]);

  useEffect(() => {
    if (!isAddMenuOpen) {
      setAddMenuPosition(null);
      return;
    }

    const closeAddMenu = (event: MouseEvent): void => {
      const target = event.target as Node;
      const isInsideMenu = addMenuRef.current?.contains(target) ?? false;
      const isAddButton = addButtonRef.current?.contains(target) ?? false;
      if (!isInsideMenu && !isAddButton) {
        workspacesStore.closeAddMenu();
      }
    };

    window.addEventListener('click', closeAddMenu);
    return () => {
      window.removeEventListener('click', closeAddMenu);
    };
  }, [isAddMenuOpen]);

  const branchSourceWorkspace =
    workspaces.find((workspace) => workspace.id === branchSourceWorkspaceId) ?? null;
  const editingWorkspace =
    workspaces.find((workspace) => workspace.id === editingWorkspaceId) ?? null;
  const mountedWorkspaceIdSet = useMemo(() => new Set(mountedWorkspaceIds), [mountedWorkspaceIds]);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const visibleWorkspaceIds = useMemo(() => {
    if (!normalizedSearchQuery) {
      return new Set(workspaces.map((workspace) => workspace.id));
    }

    const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
    const matchedWorkspaceIds = workspaces
      .filter((workspace) => workspace.name.toLowerCase().includes(normalizedSearchQuery))
      .map((workspace) => workspace.id);
    const expandedVisibleIds = new Set<string>();

    for (const workspaceId of matchedWorkspaceIds) {
      expandedVisibleIds.add(workspaceId);
      let cursor = workspaceById.get(workspaceId);
      while (cursor?.sourceWorkspaceId) {
        expandedVisibleIds.add(cursor.sourceWorkspaceId);
        cursor = workspaceById.get(cursor.sourceWorkspaceId);
      }
    }

    return expandedVisibleIds;
  }, [normalizedSearchQuery, workspaces]);

  const ungroupedRows = useMemo(
    () => toWorkspaceRows(workspaces, visibleWorkspaceIds, null),
    [workspaces, visibleWorkspaceIds]
  );

  const groupRowsByGroupId = useMemo(() => {
    const map = new Map<string, WorkspaceRenderRow[]>();
    for (const group of groups) {
      map.set(group.id, toWorkspaceRows(workspaces, visibleWorkspaceIds, group.id));
    }
    return map;
  }, [workspaces, visibleWorkspaceIds, groups]);

  const contextMenuWorkspace =
    workspaces.find((workspace) => workspace.id === contextMenuState?.workspaceId) ?? null;
  const contextMenuGroup =
    groups.find((group) => group.id === groupContextMenuState?.groupId) ?? null;

  const closeEditorDialog = (): void => {
    setEditorOpen(false);
    setEditingWorkspaceId(null);
  };

  const openCreateDialog = (): void => {
    setEditorMode('create');
    setEditingWorkspaceId(null);
    setEditorOpen(true);
  };

  const openEditDialog = (workspaceId: string): void => {
    setEditorMode('edit');
    setEditingWorkspaceId(workspaceId);
    setEditorOpen(true);
    setContextMenuState(null);
  };

  const openGroupDialog = (mode: 'create' | 'edit', groupId?: string): void => {
    setGroupDialogMode(mode);
    if (mode === 'edit' && groupId) {
      setEditingGroupId(groupId);
      const group = groups.find((g) => g.id === groupId);
      setGroupNameInput(group?.name ?? '');
    } else {
      setEditingGroupId(null);
      setGroupNameInput('');
    }
    setGroupDialogOpen(true);
    setGroupContextMenuState(null);
  };

  const closeGroupDialog = (): void => {
    setGroupDialogOpen(false);
    setEditingGroupId(null);
    setGroupNameInput('');
  };

  const handleCreate = async (input: {
    name: string;
    rootDir: string;
    iconKey?: string;
    iconColor?: string;
    groupId?: string;
  }): Promise<void> => {
    await workspacesStore.createWorkspace(input);
    if (!workspacesStore.getState().errorMessage) {
      closeEditorDialog();
    }
  };

  const handleUpdate = async (input: {
    workspaceId: string;
    name: string;
    rootDir: string;
    iconKey: string;
    iconColor: string;
    groupId?: string;
  }): Promise<void> => {
    await workspacesStore.updateWorkspace(input);
    if (!workspacesStore.getState().errorMessage) {
      closeEditorDialog();
    }
  };

  const handleDeleteWorkspace = async (workspaceId: string): Promise<void> => {
    await workspacesStore.deleteWorkspace(workspaceId);
    setWorkspacePendingDelete(null);
    setContextMenuState(null);
  };

  const handleWorkspaceClick = (workspaceId: string): void => {
    if (workspaceId === activeWorkspaceId) {
      return;
    }
    void workspacesStore.openWorkspace(workspaceId);
  };

  const handleSubmitGroupDialog = async (): Promise<void> => {
    const name = groupNameInput.trim();
    if (!name) return;

    if (groupDialogMode === 'edit' && editingGroupId) {
      await workspacesStore.updateWorkspaceGroup(editingGroupId, name);
    } else {
      await workspacesStore.createWorkspaceGroup(name);
    }

    if (!workspacesStore.getState().errorMessage) {
      closeGroupDialog();
    }
  };

  const handleDeleteGroup = async (groupId: string): Promise<void> => {
    await workspacesStore.deleteWorkspaceGroup(groupId);
    setGroupPendingDelete(null);
    setGroupContextMenuState(null);
  };

  const platform =
    typeof window === 'undefined'
      ? 'linux'
      : (
          window as Window & {
            openweaveShell?: {
              platform?: string;
            };
          }
        ).openweaveShell?.platform ?? 'linux';
  const openInDirectoryLabel =
    platform === 'darwin' ? t('workspace.menu.openInFinder') : t('workspace.menu.openInFolder');

  const resolveInsertIndex = (event: React.DragEvent, container: HTMLElement, draggedId: string | null): number => {
    const items = container.querySelectorAll<HTMLElement>('li[data-workspace-id]');
    if (items.length === 0) return 0;
    let index = 0;
    for (const item of items) {
      if (draggedId && item.dataset.workspaceId === draggedId) continue;
      const rect = item.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (event.clientY < midY) return index;
      index++;
    }
    return index;
  };

  const handleContainerDragOver = (
    event: React.DragEvent,
    targetType: 'ungrouped' | 'group',
    groupId?: string
  ): void => {
    event.preventDefault();
    const container = event.currentTarget as HTMLElement;
    const insertIndex = resolveInsertIndex(event, container, draggedWorkspaceId);
    setDropIndicator((prev) => {
      if (
        prev?.targetType === targetType &&
        prev?.groupId === groupId &&
        prev?.insertIndex === insertIndex
      ) {
        return prev;
      }
      return { targetType, groupId, insertIndex };
    });
  };

  const handleContainerDragLeave = (event: React.DragEvent): void => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setDropIndicator(null);
    }
  };

  const dropIndicatorEl = (key: string): JSX.Element => (
    <li key={key} className="ow-workspace-drop-indicator" aria-hidden="true" />
  );

  const computeIndicatorPosition = (
    rows: WorkspaceRenderRow[],
    insertIndex: number,
    draggedId: string | null
  ): number => {
    if (insertIndex < 0) return -1;
    if (!draggedId) return insertIndex;
    const filtered = rows.filter((r) => r.workspace.id !== draggedId);
    if (insertIndex >= filtered.length) return rows.length;
    const targetId = filtered[insertIndex].workspace.id;
    return rows.findIndex((r) => r.workspace.id === targetId);
  };

  const renderWorkspaceRow = (row: WorkspaceRenderRow, index: number, rows: WorkspaceRenderRow[]): JSX.Element => {
    const { workspace, depth, rootWorkspaceId } = row;
    const mounted = mountedWorkspaceIdSet.has(workspace.id);
    const selected = workspace.id === activeWorkspaceId;
    const previousRootWorkspaceId = rows[index - 1]?.rootWorkspaceId;
    const startsGroup = index === 0 || previousRootWorkspaceId !== rootWorkspaceId;
    const isTopLevel = !workspace.sourceWorkspaceId;

    return (
      <li
        key={workspace.id}
        className={`ow-workspace-list__item${selected ? ' is-selected' : ''}${startsGroup ? ' is-group-start' : ''}${depth > 0 ? ' is-branch' : ''}`}
        data-testid={`workspace-row-${workspace.id}`}
        data-workspace-id={workspace.id}
        style={{ '--workspace-depth': String(depth) } as CSSProperties}
        draggable={isTopLevel}
        onDragStart={(event) => {
          if (!isTopLevel) return;
          event.dataTransfer.setData('application/x-workspace-id', workspace.id);
          event.dataTransfer.effectAllowed = 'move';
          setDraggedWorkspaceId(workspace.id);
        }}
        onDragEnd={() => {
          setDropIndicator(null);
          setDraggedWorkspaceId(null);
        }}
        onClick={() => handleWorkspaceClick(workspace.id)}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setContextMenuState({
            workspaceId: workspace.id,
            x: event.clientX,
            y: event.clientY
          });
        }}
      >
        <div className="ow-workspace-list__item-main">
          <WorkspaceGlyph
            className="ow-workspace-list__item-icon"
            iconKey={workspace.iconKey}
            color={workspace.iconColor}
            muted={!mounted}
            size={17}
          />
          <span className={`ow-workspace-list__item-name${selected ? ' is-selected' : ''}`}>
            {workspace.name}
          </span>
        </div>

        <button
          type="button"
          className="ow-workspace-list__item-delete"
          aria-label={t('workspace.menu.delete')}
          onClick={(event) => {
            event.stopPropagation();
            setWorkspacePendingDelete(workspace);
          }}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
            <path
              d="M6 7h12M9.5 7V5h5v2M8 7l1 12h6l1-12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </li>
    );
  };

  return (
    <section className={`ow-workspace-list ow-workspace-list--${variant}`} data-testid="workspace-list-page">
      <div className="ow-workspace-list__toolbar-row">
        <h3 data-testid="workspace-panel-title">{t('workspace.panelTitle')}</h3>
        <div className="ow-workspace-list__toolbar-actions">
          <button
            ref={addButtonRef}
            className="ow-workspace-list__add-button"
            data-testid="workspace-add-button"
            disabled={loading}
            onClick={() => {
              const rect = addButtonRef.current?.getBoundingClientRect();
              if (rect) {
                setAddMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
              }
              workspacesStore.openAddMenu();
            }}
            type="button"
            title={t('workspace.add')}
            aria-label={t('workspace.add')}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
              <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          {isAddMenuOpen && addMenuPosition
            ? createPortal(
                <div
                  className="ow-workspace-add-menu"
                  data-testid="workspace-add-menu"
                  ref={addMenuRef}
                  style={{ top: addMenuPosition.top, right: addMenuPosition.right }}
                >
                  <button
                    data-testid="workspace-add-menu-create-workspace"
                    onClick={() => {
                      openCreateDialog();
                      workspacesStore.closeAddMenu();
                    }}
                    type="button"
                  >
                    {t('workspace.addMenu.createWorkspace')}
                  </button>
                  <button
                    data-testid="workspace-add-menu-create-group"
                    onClick={() => {
                      openGroupDialog('create');
                      workspacesStore.closeAddMenu();
                    }}
                    type="button"
                  >
                    {t('workspace.addMenu.createGroup')}
                  </button>
                </div>,
                document.body
              )
            : null}
          {onToggleCollapse ? (
            <button
              className="ow-workspace-list__collapse-icon"
              data-testid="workspace-collapse-button"
              onClick={onToggleCollapse}
              type="button"
              title={t('inspector.collapse')}
              aria-label={t('inspector.collapse')}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
                <path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      <label className="ow-workspace-list__search" aria-label={t('workspace.searchPlaceholder')}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15">
          <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="m16 16 5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
              e.preventDefault();
              e.currentTarget.select();
            }
          }}
          placeholder={t('workspace.searchPlaceholder')}
          data-testid="workspace-search-input"
        />
      </label>

      <div className="ow-workspace-list__divider" data-testid="workspace-list-divider" />

      <CreateWorkspaceDialog
        open={editorOpen}
        loading={loading}
        mode={editorMode}
        workspace={editorMode === 'edit' ? editingWorkspace : null}
        groups={groups}
        onCancel={closeEditorDialog}
        onPickDirectory={(initialPath) => workspacesStore.pickDirectory(initialPath)}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />

      <BranchWorkspaceDialog
        open={isBranchDialogOpen}
        loading={loading}
        sourceWorkspace={branchSourceWorkspace}
        onCancel={() => workspacesStore.closeBranchDialog()}
        onCreate={(input) => workspacesStore.createBranchWorkspace(input)}
      />

      {errorMessage ? (
        <p className="ow-workspace-list__error" data-testid="workspace-error">
          {errorMessage}
        </p>
      ) : null}

      <span data-testid="active-workspace-name" className="ow-workspace-list__active-sr">
        {activeWorkspace?.name ?? 'none'}
      </span>

      {ungroupedRows.length === 0 && groups.length === 0 ? (
        <p className="ow-workspace-list__empty" data-testid="workspace-empty">
          {normalizedSearchQuery ? t('workspace.emptyFiltered') : t('workspace.empty')}
        </p>
      ) : (
        <>
          <section
            className="ow-workspace-list__ungrouped-section"
            data-testid="workspace-ungrouped-section"
            onDragOver={(event) => handleContainerDragOver(event, 'ungrouped')}
            onDragLeave={handleContainerDragLeave}
            onDrop={(event) => {
              event.preventDefault();
              const workspaceId = event.dataTransfer.getData('application/x-workspace-id');
              if (workspaceId && dropIndicator?.targetType === 'ungrouped') {
                void workspacesStore.moveWorkspaceToUngrouped(workspaceId, dropIndicator.insertIndex);
              }
              setDropIndicator(null);
            }}
          >
            {ungroupedRows.length === 0 && !normalizedSearchQuery ? null : (
              <ul className="ow-workspace-list__items" data-testid="workspace-ungrouped-list">
                {(() => {
                  const visualIndex = computeIndicatorPosition(
                    ungroupedRows,
                    dropIndicator?.targetType === 'ungrouped' ? dropIndicator.insertIndex : -1,
                    draggedWorkspaceId
                  );
                  return ungroupedRows.reduce<JSX.Element[]>((acc, row, index) => {
                    if (dropIndicator?.targetType === 'ungrouped' && visualIndex === index) {
                      acc.push(dropIndicatorEl(`indicator-${index}`));
                    }
                    acc.push(renderWorkspaceRow(row, index, ungroupedRows));
                    return acc;
                  }, []);
                })()}
                {dropIndicator?.targetType === 'ungrouped' &&
                computeIndicatorPosition(
                  ungroupedRows,
                  dropIndicator.insertIndex,
                  draggedWorkspaceId
                ) >= ungroupedRows.length
                  ? dropIndicatorEl('indicator-end')
                  : null}
              </ul>
            )}
            <div
              className="ow-workspace-list__drop-zone"
              data-testid="workspace-ungrouped-drop-zone"
            />
          </section>

          <section className="ow-workspace-list__groups-section" data-testid="workspace-groups-section">
            {groups.map((group) => {
              const uiState = groupUiState[group.id];
              const collapsed = uiState?.collapsed ?? false;
              const memberRows = groupRowsByGroupId.get(group.id) ?? [];
              const hasMembers = memberRows.length > 0;

              const isGroupTarget =
                dropIndicator?.targetType === 'group' && dropIndicator?.groupId === group.id;

              return (
                <div
                  key={group.id}
                  className="ow-workspace-list__group"
                  onDragOver={(event) => handleContainerDragOver(event, 'group', group.id)}
                  onDragLeave={handleContainerDragLeave}
                  onDrop={(event) => {
                    event.preventDefault();
                    const workspaceId = event.dataTransfer.getData('application/x-workspace-id');
                    if (workspaceId && isGroupTarget) {
                      void workspacesStore.moveWorkspaceToGroup(
                        workspaceId,
                        group.id,
                        dropIndicator.insertIndex
                      );
                    }
                    setDropIndicator(null);
                  }}
                >
                  <div
                    className="ow-workspace-list__group-header"
                    data-testid={`workspace-group-row-${group.name}`}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setGroupContextMenuState({
                        groupId: group.id,
                        x: event.clientX,
                        y: event.clientY
                      });
                    }}
                  >
                    <button
                      type="button"
                      className="ow-workspace-list__group-toggle"
                      data-testid={`workspace-group-toggle-${group.id}`}
                      onClick={() => void workspacesStore.setGroupCollapsed(group.id, !collapsed)}
                      aria-expanded={!collapsed}
                    >
                      {collapsed ? '▶' : '▼'}
                    </button>
                    <span className="ow-workspace-list__group-name">{group.name}</span>
                  </div>

                  {(!collapsed || normalizedSearchQuery) && hasMembers ? (
                    <div className="ow-workspace-list__group-members">
                      <ul className="ow-workspace-list__items">
                        {(() => {
                          const visualIndex = isGroupTarget
                            ? computeIndicatorPosition(memberRows, dropIndicator.insertIndex, draggedWorkspaceId)
                            : -1;
                          return memberRows.reduce<JSX.Element[]>((acc, row, index) => {
                            if (isGroupTarget && visualIndex === index) {
                              acc.push(dropIndicatorEl(`indicator-${index}`));
                            }
                            acc.push(renderWorkspaceRow(row, index, memberRows));
                            return acc;
                          }, []);
                        })()}
                        {isGroupTarget &&
                        computeIndicatorPosition(
                          memberRows,
                          dropIndicator.insertIndex,
                          draggedWorkspaceId
                        ) >= memberRows.length
                          ? dropIndicatorEl('indicator-end')
                          : null}
                      </ul>
                    </div>
                  ) : isGroupTarget ? (
                    <div className="ow-workspace-list__group-members">
                      {dropIndicatorEl('indicator-empty')}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>
        </>
      )}

      {contextMenuWorkspace
        ? createPortal(
            <div
              className="ow-workspace-context-menu"
              role="menu"
              data-testid="workspace-context-menu"
              style={
                {
                  top: Math.max(12, contextMenuState?.y ?? 12),
                  left: Math.max(12, contextMenuState?.x ?? 12)
                } as CSSProperties
              }
              onMouseLeave={() => setContextMenuState(null)}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  void workspacesStore.revealDirectory(contextMenuWorkspace.rootDir);
                  setContextMenuState(null);
                }}
              >
                <span className="ow-workspace-menu__icon" aria-hidden="true">📁</span>
                <span>{openInDirectoryLabel}</span>
              </button>
              <button type="button" role="menuitem" onClick={() => openEditDialog(contextMenuWorkspace.id)}>
                <span className="ow-workspace-menu__icon" aria-hidden="true">✏️</span>
                <span>{t('workspace.menu.edit')}</span>
              </button>
              <button type="button" role="menuitem" onClick={() => openEditDialog(contextMenuWorkspace.id)}>
                <span className="ow-workspace-menu__icon" aria-hidden="true">📝</span>
                <span>{t('workspace.menu.rename')}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setWorkspacePendingDelete(contextMenuWorkspace);
                  setContextMenuState(null);
                }}
              >
                <span className="ow-workspace-menu__icon" aria-hidden="true">🗑️</span>
                <span>{t('workspace.menu.delete')}</span>
              </button>
              {mountedWorkspaceIdSet.has(contextMenuWorkspace.id) ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    workspacesStore.unmountWorkspace(contextMenuWorkspace.id);
                    setContextMenuState(null);
                  }}
                >
                  <span className="ow-workspace-menu__icon" aria-hidden="true">📤</span>
                  <span>{t('workspace.menu.unmount')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    workspacesStore.mountWorkspace(contextMenuWorkspace.id);
                    void workspacesStore.openWorkspace(contextMenuWorkspace.id);
                    setContextMenuState(null);
                  }}
                >
                  <span className="ow-workspace-menu__icon" aria-hidden="true">📥</span>
                  <span>{t('workspace.menu.mount')}</span>
                </button>
              )}
            </div>,
            document.body
          )
        : null}

      {groupContextMenuState && contextMenuGroup
        ? createPortal(
            <div
              className="ow-workspace-context-menu"
              role="menu"
              data-testid="group-context-menu"
              style={
                {
                  top: Math.max(12, groupContextMenuState?.y ?? 12),
                  left: Math.max(12, groupContextMenuState?.x ?? 12)
                } as CSSProperties
              }
              onMouseLeave={() => setGroupContextMenuState(null)}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => openGroupDialog('edit', contextMenuGroup.id)}
              >
                <span className="ow-workspace-menu__icon" aria-hidden="true">✏️</span>
                <span>{t('workspace.menu.editGroup')}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setGroupPendingDelete(contextMenuGroup);
                  setGroupContextMenuState(null);
                }}
              >
                <span className="ow-workspace-menu__icon" aria-hidden="true">🗑️</span>
                <span>{t('workspace.menu.deleteGroup')}</span>
              </button>
            </div>,
            document.body
          )
        : null}

      {workspacePendingDelete
        ? createPortal(
            <div className="ow-workspace-dialog" role="dialog" aria-modal="true">
              <div className="ow-workspace-dialog__backdrop" onClick={() => setWorkspacePendingDelete(null)} />
              <section className="ow-workspace-dialog__surface ow-workspace-dialog__surface--confirm">
                <h2>{t('workspace.deleteConfirm.title')}</h2>
                <p>{t('workspace.deleteConfirm.body').replace('{name}', workspacePendingDelete.name)}</p>
                <div className="ow-workspace-dialog__actions">
                  <button className="ow-toolbar-button" type="button" onClick={() => setWorkspacePendingDelete(null)}>
                    {t('workspace.dialog.cancel')}
                  </button>
                  <button
                    className="ow-toolbar-button ow-toolbar-button--danger"
                    data-testid="workspace-delete-confirm"
                    type="button"
                    onClick={() => void handleDeleteWorkspace(workspacePendingDelete.id)}
                    disabled={loading}
                  >
                    {t('workspace.deleteConfirm.confirm')}
                  </button>
                </div>
              </section>
            </div>,
            document.body
          )
        : null}

      {groupPendingDelete
        ? createPortal(
            <div className="ow-workspace-dialog" role="dialog" aria-modal="true">
              <div className="ow-workspace-dialog__backdrop" onClick={() => setGroupPendingDelete(null)} />
              <section className="ow-workspace-dialog__surface ow-workspace-dialog__surface--confirm">
                <h2>{t('workspace.groupDeleteConfirm.title')}</h2>
                <p>{t('workspace.groupDeleteConfirm.body').replace('{name}', groupPendingDelete.name)}</p>
                <div className="ow-workspace-dialog__actions">
                  <button className="ow-toolbar-button" type="button" onClick={() => setGroupPendingDelete(null)}>
                    {t('workspace.group.dialog.cancel')}
                  </button>
                  <button
                    className="ow-toolbar-button ow-toolbar-button--danger"
                    type="button"
                    onClick={() => void handleDeleteGroup(groupPendingDelete.id)}
                    disabled={loading}
                  >
                    {t('workspace.groupDeleteConfirm.confirm')}
                  </button>
                </div>
              </section>
            </div>,
            document.body
          )
        : null}

      {groupDialogOpen
        ? createPortal(
            <div className="ow-workspace-dialog" role="dialog" aria-modal="true">
              <div className="ow-workspace-dialog__backdrop" onClick={closeGroupDialog} />
              <section className="ow-workspace-dialog__surface ow-workspace-dialog__surface--group">
                <h2>
                  {groupDialogMode === 'create'
                    ? t('workspace.group.dialog.createTitle')
                    : t('workspace.group.dialog.editTitle')}
                </h2>
                <label className="ow-workspace-dialog__field">
                  <span>{t('workspace.group.dialog.nameLabel')}</span>
                  <input
                    data-testid="workspace-group-name-input"
                    type="text"
                    value={groupNameInput}
                    onChange={(event) => setGroupNameInput(event.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
                        e.preventDefault();
                        e.currentTarget.select();
                      }
                    }}
                    required
                    minLength={1}
                    autoFocus={true}
                  />
                </label>
                <div className="ow-workspace-dialog__actions">
                  <button className="ow-toolbar-button" type="button" onClick={closeGroupDialog}>
                    {t('workspace.group.dialog.cancel')}
                  </button>
                  <button
                    className="ow-toolbar-button ow-toolbar-button--primary"
                    data-testid="workspace-group-submit"
                    type="button"
                    disabled={loading || !groupNameInput.trim()}
                    onClick={() => void handleSubmitGroupDialog()}
                  >
                    {groupDialogMode === 'create'
                      ? t('workspace.group.dialog.createSubmit')
                      : t('workspace.group.dialog.editSubmit')}
                  </button>
                </div>
              </section>
            </div>,
            document.body
          )
        : null}
    </section>
  );
};
