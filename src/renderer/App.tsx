import { useCallback, useEffect, useMemo, useState } from 'react';
import { canvasStore, useCanvasStore } from './features/canvas/canvas.store';
import { useCanvasShortcuts } from './features/canvas-shell/useCanvasShortcuts';
import { WorkspaceCanvasPage } from './features/canvas/WorkspaceCanvasPage';
import { CommandPalette, type CommandPaletteItem } from './features/workbench/CommandPalette';
import { WorkbenchShell } from './features/workbench/WorkbenchShell';
import { SettingsDialog } from './features/workbench/SettingsDialog';
import { WorkspaceListPage } from './features/workspaces/WorkspaceListPage';
import { CreateTerminalDialog } from './features/canvas/CreateTerminalDialog';
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
  const connectModeActive = useCanvasStore((s) => s.connectModeActive);
  const connectSourceNodeId = useCanvasStore((s) => s.connectSourceNodeId);
  const activeEdgeIds = useCanvasStore((s) => s.activeEdgeIds);
  const selectedEdgeId = useCanvasStore((s) => s.selectedEdgeId);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandPaletteMode, setCommandPaletteMode] = useState<'command' | 'quick-add'>('command');
  const [contextPanelCollapsed, setContextPanelCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [fitViewRequestId, setFitViewRequestId] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createTerminalDialogOpen, setCreateTerminalDialogOpen] = useState(false);
  const [pendingTerminalBounds, setPendingTerminalBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [placementMode, setPlacementMode] = useState<{ type: string } | null>(null);
  const [editTerminalOpen, setEditTerminalOpen] = useState(false);
  const [editTerminalNodeId, setEditTerminalNodeId] = useState<string | null>(null);
  const [editTerminalConfig, setEditTerminalConfig] = useState<Record<string, unknown> | null>(null);
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [simulateNodeId, setSimulateNodeId] = useState<string | null>(null);
  const [simulateWorkspaceId, setSimulateWorkspaceId] = useState<string | null>(null);
  const disabled = activeWorkspace === null || canvasLoading;

  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  useTheme();

  useEffect(() => {
    const handle = () => setSettingsOpen(true);
    window.addEventListener('openweave:open-settings', handle);
    return () => window.removeEventListener('openweave:open-settings', handle);
  }, []);

  useEffect(() => {
    const handleEdit = (event: Event) => {
      const detail = (event as CustomEvent).detail as { nodeId: string; config: Record<string, unknown> };
      setEditTerminalNodeId(detail.nodeId);
      setEditTerminalConfig(detail.config);
      setEditTerminalOpen(true);
    };
    window.addEventListener('openweave:edit-terminal', handleEdit);
    return () => window.removeEventListener('openweave:edit-terminal', handleEdit);
  }, []);

  useEffect(() => {
    const handleSim = (event: Event) => {
      const detail = (event as CustomEvent).detail as { nodeId: string; workspaceId: string };
      setSimulateNodeId(detail.nodeId);
      setSimulateWorkspaceId(detail.workspaceId);
      setSimulateOpen(true);
    };
    window.addEventListener('openweave:simulate-node-message', handleSim);
    return () => window.removeEventListener('openweave:simulate-node-message', handleSim);
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
    setPlacementMode({ type: 'terminal' });
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

  const handleCreateTerminalSave = useCallback(
    (config: Record<string, unknown>) => {
      setCreateTerminalDialogOpen(false);
      if (pendingTerminalBounds) {
        void canvasStore.addNodeAtBounds('builtin.terminal', pendingTerminalBounds, activeWorkspace?.rootDir ?? '', config);
        setPendingTerminalBounds(null);
      } else {
        void canvasStore.addTerminalNode(config);
      }
    },
    [pendingTerminalBounds, activeWorkspace?.rootDir]
  );

  const handleEditTerminalSave = useCallback(
    (config: Record<string, unknown>) => {
      setEditTerminalOpen(false);
      if (editTerminalNodeId) {
        void canvasStore.updateTerminalNode(editTerminalNodeId, {
          command: typeof config.command === 'string' ? config.command : '',
          runtime: config.runtime === 'codex' || config.runtime === 'claude' || config.runtime === 'opencode' ? config.runtime : 'shell',
          title: config.title ?? undefined,
          iconKey: config.iconKey ?? undefined,
          iconColor: config.iconColor ?? undefined,
          theme: config.theme ?? undefined,
          fontFamily: config.fontFamily ?? undefined,
          fontSize: config.fontSize ?? undefined,
          roleId: config.roleId ?? undefined
        } as Record<string, unknown>);
      }
    },
    [editTerminalNodeId]
  );

  const handlePlacementComplete = useCallback(
    (type: string, bounds: { x: number; y: number; width: number; height: number }) => {
      const componentType = `builtin.${type}`;
      if (componentType === 'builtin.terminal') {
        setPendingTerminalBounds(bounds);
        setCreateTerminalDialogOpen(true);
        setPlacementMode(null);
        return;
      }
      void canvasStore.addNodeAtBounds(componentType, bounds, activeWorkspace?.rootDir ?? '');
      setPlacementMode(null);
    },
    [activeWorkspace?.rootDir]
  );

  const selectNode = useCallback((nodeId: string | null) => {
    canvasStore.selectNode(nodeId);
  }, []);

  const toggleConnectMode = useCallback(() => {
    canvasStore.toggleConnectMode();
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
      if (canvasStore.getState().selectedEdgeId) {
        void canvasStore.deleteSelectedEdge();
      } else {
        void canvasStore.deleteSelectedNode();
      }
    },
    onUndo: () => {
      void canvasStore.undo();
    },
    onRedo: () => {
      void canvasStore.redo();
    },
    onToggleConnectMode: toggleConnectMode
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
      onAddTerminal={addTerminal}
      placementMode={placementMode}
      onPlacementComplete={handlePlacementComplete}
      onPlacementCancel={cancelPlacement}
      connectModeActive={connectModeActive}
      connectSourceNodeId={connectSourceNodeId}
      activeEdgeIds={activeEdgeIds}
      selectedEdgeId={selectedEdgeId}
      onToggleConnectMode={toggleConnectMode}
      onSelectConnectSource={(nodeId) => canvasStore.setConnectSourceNode(nodeId)}
      onCompleteConnection={(sourceId, targetId) => { void canvasStore.addEdge(sourceId, targetId); }}
      onSelectEdge={(edgeId) => canvasStore.selectEdge(edgeId)}
      onDeleteSelectedEdge={() => { void canvasStore.deleteSelectedEdge(); }}
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
      connectModeActive={connectModeActive}
      onToggleConnectMode={toggleConnectMode}
      contextPanel={
        <WorkspaceListPage
          variant="panel"
          collapsed={contextPanelCollapsed}
          onToggleCollapse={toggleContextPanel}
        />
      }
      commandMenuDisabled={disabled}
      commandPalette={
        <CommandPalette
          items={commandPaletteMode === 'quick-add' ? quickAddItems : commandItems}
          mode={commandPaletteMode}
          onClose={closeCommandPalette}
          open={commandPaletteOpen}
          showTrigger={false}
        />
      }
      disabled={disabled}
      edgeCount={graphSnapshot.edges.length}
      contextPanelCollapsed={contextPanelCollapsed}
      fitViewDisabled={disabled}
      inspectorCollapsed={inspectorCollapsed}
      inspectorDisabled={false}
      nodeCount={graphSnapshot.nodes.length}
      onAddTerminal={addTerminal}
      onAddNote={addNote}
      onAddPortal={addPortal}
      onAddFileTree={addFileTree}
      onAddText={addText}
      onOpenCommandMenu={openCommandPalette}
      onOpenQuickAdd={openQuickAdd}
      onFitCanvas={requestFitCanvas}
      onToggleContextPanel={toggleContextPanel}
      onToggleInspector={toggleInspector}
      onOpenSettings={() => setSettingsOpen(true)}
      recentAction={recentAction}
      selectedNode={selectedNode}
      quickAddDisabled={disabled}
      stage={stage}
      workspaceName={activeWorkspace?.name ?? null}
      workspaceRootDir={activeWorkspace?.rootDir ?? null}
      activePlacementType={placementMode?.type ?? null}
      onTogglePlacement={togglePlacement}
    />
    <SettingsDialog open={settingsOpen} onClose={closeSettings} />
    <CreateTerminalDialog
      open={createTerminalDialogOpen}
      workspaceRootDir={activeWorkspace?.rootDir ?? ''}
      onClose={() => {
        setCreateTerminalDialogOpen(false);
        setPendingTerminalBounds(null);
      }}
      onSave={handleCreateTerminalSave}
    />
    <CreateTerminalDialog
      open={editTerminalOpen}
      mode="edit"
      initialConfig={editTerminalConfig}
      workspaceRootDir={activeWorkspace?.rootDir ?? ''}
      onClose={() => {
        setEditTerminalOpen(false);
        setEditTerminalNodeId(null);
        setEditTerminalConfig(null);
      }}
      onSave={handleEditTerminalSave}
    />
    {simulateOpen && simulateNodeId && simulateWorkspaceId && (
      <SimulateNodeMessageDialog
        open={simulateOpen}
        nodeId={simulateNodeId}
        workspaceId={simulateWorkspaceId}
        onClose={() => {
          setSimulateOpen(false);
          setSimulateNodeId(null);
          setSimulateWorkspaceId(null);
        }}
      />
    )}
    </>
  );
};

function SimulateNodeMessageDialog({
  open,
  nodeId,
  workspaceId,
  onClose
}: {
  open: boolean;
  nodeId: string;
  workspaceId: string;
  onClose: () => void;
}): JSX.Element | null {
  const { t } = useI18n();
  const [message, setMessage] = useState('');
  const [runs, setRuns] = useState<import('../../../shared/ipc/contracts').RunRecord[]>([]);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      try {
        const bridge = (window as any).openweaveShell;
        const res = await bridge.runs.listRuns({ workspaceId, nodeId });
        setRuns(res.runs);
      } catch {
        // ignore
      }
    };
    void load();
    const timer = setInterval(load, 500);
    return () => clearInterval(timer);
  }, [open, workspaceId, nodeId]);

  const activeRun = runs.find((r) => r.status !== 'completed' && r.status !== 'failed' && r.status !== 'stopped');

  const handleSend = async () => {
    if (!activeRun || !message.trim()) return;
    try {
      const bridge = (window as any).openweaveShell;
      await bridge.runs.inputRun({ workspaceId, runId: activeRun.id, input: message.trim() });
      setMessage('');
    } catch {
      // ignore
    }
  };

  if (!open) return null;

  return (
    <div className="ow-workspace-dialog ow-simulate-dialog" role="dialog" aria-modal="true">
      <div className="ow-workspace-dialog__backdrop" onClick={onClose} />
      <section className="ow-workspace-dialog__surface ow-workspace-dialog__surface--confirm">
        <header className="ow-workspace-dialog__header">
          <h2>{t('terminal.simulate.title')}</h2>
        </header>
        <div className="ow-workspace-dialog__form">
          {!activeRun && (
            <p className="ow-simulate-dialog__status">{t('terminal.simulate.noRun')}</p>
          )}
          {activeRun && (
            <>
              <p className="ow-simulate-dialog__status">{t('terminal.simulate.activeRun')}: {activeRun.id.slice(0, 8)}...</p>
              <div className="ow-workspace-dialog__field">
                <span>{t('terminal.simulate.messageLabel')}</span>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
                      e.preventDefault();
                      e.currentTarget.select();
                    }
                  }}
                  placeholder={t('terminal.simulate.messagePlaceholder')}
                  autoFocus
                />
              </div>
            </>
          )}
          <div className="ow-workspace-dialog__actions">
            <button className="ow-toolbar-button" type="button" onClick={onClose}>{t('terminal.simulate.close')}</button>
            <button
              className="ow-toolbar-button ow-toolbar-button--primary"
              type="button"
              onClick={handleSend}
              disabled={!activeRun || !message.trim()}
            >
              {t('terminal.simulate.send')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
