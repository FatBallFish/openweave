import { useCallback, useEffect, useMemo, useState } from 'react';
import { canvasStore, useCanvasStore } from './features/canvas/canvas.store';
import { useCanvasShortcuts } from './features/canvas-shell/useCanvasShortcuts';
import { WorkspaceCanvasPage } from './features/canvas/WorkspaceCanvasPage';
import { CommandPalette, type CommandPaletteItem } from './features/workbench/CommandPalette';
import { WorkbenchShell } from './features/workbench/WorkbenchShell';
import { SettingsDialog } from './features/workbench/SettingsDialog';
import { WorkspaceListPage } from './features/workspaces/WorkspaceListPage';
import { useWorkspacesStore } from './features/workspaces/workspaces.store';
import { useI18n } from './i18n/provider';
import { useTheme } from './hooks/useTheme';

const createEmptyGraphSnapshot = () => ({
  schemaVersion: 2 as const,
  nodes: [],
  edges: []
});

export const App = (): JSX.Element => {
  const { t } = useI18n();
  const workspaces = useWorkspacesStore((storeState) => storeState.workspaces);
  const activeWorkspaceId = useWorkspacesStore((storeState) => storeState.activeWorkspaceId);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
  const canvasLoading = useCanvasStore((storeState) => storeState.loading);
  const graphSnapshot = useCanvasStore((storeState) => storeState.graphSnapshot) ?? createEmptyGraphSnapshot();
  const selectedNodeId = useCanvasStore((storeState) => storeState.selectedNodeId) ?? null;
  const recentAction = useCanvasStore((storeState) => storeState.recentAction) ?? null;
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandPaletteMode, setCommandPaletteMode] = useState<'command' | 'quick-add'>('command');
  const [contextPanelCollapsed, setContextPanelCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [fitViewRequestId, setFitViewRequestId] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [placementMode, setPlacementMode] = useState<{ type: string } | null>(null);
  const disabled = activeWorkspace === null || canvasLoading;

  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  useTheme();

  useEffect(() => {
    const handle = () => setSettingsOpen(true);
    window.addEventListener('openweave:open-settings', handle);
    return () => window.removeEventListener('openweave:open-settings', handle);
  }, []);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) {
      return null;
    }

    const node = graphSnapshot.nodes.find((candidate) => candidate.id === selectedNodeId);
    if (!node) {
      return null;
    }

    return {
      id: node.id,
      title: node.title,
      componentType: node.componentType,
      capabilities: node.capabilities
    };
  }, [graphSnapshot.nodes, selectedNodeId]);

  const closeCommandPalette = useCallback(() => {
    setCommandPaletteOpen(false);
  }, []);

  const openCommandPalette = useCallback(() => {
    setCommandPaletteMode('command');
    setCommandPaletteOpen(true);
  }, []);

  const openQuickAdd = useCallback(() => {
    setCommandPaletteMode('quick-add');
    setCommandPaletteOpen(true);
  }, []);

  const toggleInspector = useCallback(() => {
    setInspectorCollapsed((value) => !value);
  }, []);

  const toggleContextPanel = useCallback(() => {
    setContextPanelCollapsed((value) => !value);
  }, []);

  const requestFitCanvas = useCallback(() => {
    setFitViewRequestId((value) => value + 1);
  }, []);

  const addTerminal = useCallback(() => {
    void canvasStore.addTerminalNode();
  }, []);

  const addNote = useCallback(() => {
    void canvasStore.addNoteNode();
  }, []);

  const addPortal = useCallback(() => {
    void canvasStore.addPortalNode();
  }, []);

  const addFileTree = useCallback(() => {
    void canvasStore.addFileTreeNode(activeWorkspace?.rootDir ?? '');
  }, [activeWorkspace?.rootDir]);

  const addText = useCallback(() => {
    void canvasStore.addTextNode();
  }, []);

  const togglePlacement = useCallback((type: string) => {
    setPlacementMode((current) => (current?.type === type ? null : { type }));
  }, []);

  const cancelPlacement = useCallback(() => {
    setPlacementMode(null);
  }, []);

  const handlePlacementComplete = useCallback(
    (type: string, bounds: { x: number; y: number; width: number; height: number }) => {
      const componentType = `builtin.${type}`;
      void canvasStore.addNodeAtBounds(componentType, bounds, activeWorkspace?.rootDir ?? '');
      setPlacementMode(null);
    },
    [activeWorkspace?.rootDir]
  );

  const selectNode = useCallback((nodeId: string | null) => {
    canvasStore.selectNode(nodeId);
  }, []);

  const commandItems = useMemo<CommandPaletteItem[]>(
    () => [
      {
        id: 'create-terminal',
        label: t('topbar.addTerminal'),
        hint: '1',
        section: t('topbar.clusterCreate'),
        onSelect: () => {
          closeCommandPalette();
          addTerminal();
        }
      },
      {
        id: 'create-note',
        label: t('topbar.addNote'),
        hint: '2',
        section: t('topbar.clusterCreate'),
        onSelect: () => {
          closeCommandPalette();
          addNote();
        }
      },
      {
        id: 'create-portal',
        label: t('topbar.addPortal'),
        hint: '3',
        section: t('topbar.clusterCreate'),
        onSelect: () => {
          closeCommandPalette();
          addPortal();
        }
      },
      {
        id: 'create-file-tree',
        label: t('topbar.addFileTree'),
        hint: '4',
        section: t('topbar.clusterCreate'),
        onSelect: () => {
          closeCommandPalette();
          addFileTree();
        }
      },
      {
        id: 'create-text',
        label: t('topbar.addText'),
        hint: '5',
        section: t('topbar.clusterCreate'),
        onSelect: () => {
          closeCommandPalette();
          addText();
        }
      },
      {
        id: 'open-quick-add',
        label: t('inspector.quickAdd'),
        hint: '/',
        section: t('topbar.clusterCanvas'),
        onSelect: () => {
          closeCommandPalette();
          openQuickAdd();
        }
      },
      {
        id: 'toggle-inspector',
        label: t('inspector.toggleInspector'),
        hint: 'Cmd/Ctrl+Shift+I',
        section: t('topbar.clusterCanvas'),
        onSelect: () => {
          closeCommandPalette();
          toggleInspector();
        }
      }
    ],
    [
      addFileTree,
      addNote,
      addPortal,
      addTerminal,
      addText,
      closeCommandPalette,
      openQuickAdd,
      toggleInspector
    ]
  );

  const quickAddItems = useMemo(
    () => commandItems.filter((item) => item.section === t('topbar.clusterCreate')),
    [commandItems, t]
  );

  useCanvasShortcuts({
    enabled: !disabled,
    onOpenCommandPalette: openCommandPalette,
    onOpenQuickAdd: openQuickAdd,
    onToggleInspector: toggleInspector,
    onAddTerminal: addTerminal,
    onAddNote: addNote,
    onAddPortal: addPortal,
    onAddFileTree: addFileTree,
    onAddText: addText,
    onEscape: closeCommandPalette,
    onDeleteSelected: () => {
      void canvasStore.deleteSelectedNode();
    },
    onUndo: () => {
      void canvasStore.undo();
    },
    onRedo: () => {
      void canvasStore.redo();
    }
  });

  const stage = activeWorkspace ? (
    <WorkspaceCanvasPage
      fitViewRequestId={fitViewRequestId}
      workspaceId={activeWorkspace.id}
      workspaceName={activeWorkspace.name}
      workspaceRootDir={activeWorkspace.rootDir}
      onOpenCommandPalette={openCommandPalette}
      onOpenQuickAdd={openQuickAdd}
      onSelectNode={selectNode}
      placementMode={placementMode}
      onPlacementComplete={handlePlacementComplete}
      onPlacementCancel={cancelPlacement}
    />
  ) : (
      <div className="ow-workbench-stage__empty" data-testid="workbench-stage-empty">
        <div>
          <strong>{t('app.stageEmptyTitle')}</strong>
          {t('app.stageEmptyDescription')}
        </div>
      </div>
  );

  return (
    <>
      <WorkbenchShell
      contextPanel={
        <WorkspaceListPage
          variant="panel"
          collapsed={contextPanelCollapsed}
          onToggleCollapse={toggleContextPanel}
        />
      }
      commandPalette={
        <CommandPalette
          items={commandPaletteMode === 'quick-add' ? quickAddItems : commandItems}
          mode={commandPaletteMode}
          onClose={closeCommandPalette}
          open={commandPaletteOpen}
          showTrigger={false}
        />
      }
      edgeCount={graphSnapshot.edges.length}
      contextPanelCollapsed={contextPanelCollapsed}
      inspectorCollapsed={inspectorCollapsed}
      nodeCount={graphSnapshot.nodes.length}
      onToggleContextPanel={toggleContextPanel}
      onToggleInspector={toggleInspector}
      onOpenSettings={() => setSettingsOpen(true)}
      recentAction={recentAction}
      selectedNode={selectedNode}
      stage={stage}
      workspaceName={activeWorkspace?.name ?? null}
      workspaceRootDir={activeWorkspace?.rootDir ?? null}
    />
    <SettingsDialog open={settingsOpen} onClose={closeSettings} />
    </>
  );
};
