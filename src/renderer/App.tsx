import { useCallback, useMemo, useState } from 'react';
import { canvasStore, useCanvasStore } from './features/canvas/canvas.store';
import { useCanvasShortcuts } from './features/canvas-shell/useCanvasShortcuts';
import { WorkspaceCanvasPage } from './features/canvas/WorkspaceCanvasPage';
import { CommandPalette, type CommandPaletteItem } from './features/workbench/CommandPalette';
import { WorkbenchShell } from './features/workbench/WorkbenchShell';
import { WorkspaceListPage } from './features/workspaces/WorkspaceListPage';
import { useWorkspacesStore } from './features/workspaces/workspaces.store';

const createEmptyGraphSnapshot = () => ({
  schemaVersion: 2 as const,
  nodes: [],
  edges: []
});

export const App = (): JSX.Element => {
  const workspaces = useWorkspacesStore((storeState) => storeState.workspaces);
  const activeWorkspaceId = useWorkspacesStore((storeState) => storeState.activeWorkspaceId);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
  const canvasLoading = useCanvasStore((storeState) => storeState.loading);
  const graphSnapshot = useCanvasStore((storeState) => storeState.graphSnapshot) ?? createEmptyGraphSnapshot();
  const selectedNodeId = useCanvasStore((storeState) => storeState.selectedNodeId) ?? null;
  const recentAction = useCanvasStore((storeState) => storeState.recentAction) ?? null;
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandPaletteMode, setCommandPaletteMode] = useState<'command' | 'quick-add'>('command');
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const disabled = activeWorkspace === null || canvasLoading;

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

  const selectNode = useCallback((nodeId: string | null) => {
    canvasStore.selectNode(nodeId);
  }, []);

  const commandItems = useMemo<CommandPaletteItem[]>(
    () => [
      {
        id: 'create-terminal',
        label: 'Add terminal',
        hint: '1',
        section: 'Create',
        onSelect: () => {
          closeCommandPalette();
          addTerminal();
        }
      },
      {
        id: 'create-note',
        label: 'Add note',
        hint: '2',
        section: 'Create',
        onSelect: () => {
          closeCommandPalette();
          addNote();
        }
      },
      {
        id: 'create-portal',
        label: 'Add portal',
        hint: '3',
        section: 'Create',
        onSelect: () => {
          closeCommandPalette();
          addPortal();
        }
      },
      {
        id: 'create-file-tree',
        label: 'Add file tree',
        hint: '4',
        section: 'Create',
        onSelect: () => {
          closeCommandPalette();
          addFileTree();
        }
      },
      {
        id: 'create-text',
        label: 'Add text',
        hint: '5',
        section: 'Create',
        onSelect: () => {
          closeCommandPalette();
          addText();
        }
      },
      {
        id: 'open-quick-add',
        label: 'Open quick add',
        hint: '/',
        section: 'Canvas',
        onSelect: () => {
          closeCommandPalette();
          openQuickAdd();
        }
      },
      {
        id: 'toggle-inspector',
        label: 'Toggle inspector',
        hint: 'Cmd/Ctrl+Shift+I',
        section: 'Canvas',
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
    () => commandItems.filter((item) => item.section === 'Create'),
    [commandItems]
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
    onEscape: closeCommandPalette
  });

  const stage = activeWorkspace ? (
    <WorkspaceCanvasPage
      workspaceId={activeWorkspace.id}
      workspaceName={activeWorkspace.name}
      workspaceRootDir={activeWorkspace.rootDir}
      onOpenCommandPalette={openCommandPalette}
      onOpenQuickAdd={openQuickAdd}
      onSelectNode={selectNode}
    />
  ) : (
    <div className="ow-workbench-stage__empty" data-testid="workbench-stage-empty">
      <div>
        <strong>Select or create a workspace</strong>
        Create or open a workspace to start composing workflows on the canvas.
      </div>
    </div>
  );

  return (
    <WorkbenchShell
      contextPanel={<WorkspaceListPage variant="panel" />}
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
      fitViewDisabled={disabled}
      inspectorCollapsed={inspectorCollapsed}
      nodeCount={graphSnapshot.nodes.length}
      onAddTerminal={addTerminal}
      onAddNote={addNote}
      onAddPortal={addPortal}
      onAddFileTree={addFileTree}
      onAddText={addText}
      onOpenCommandMenu={openCommandPalette}
      onFitCanvas={() => undefined}
      onOpenSettings={() => undefined}
      onToggleInspector={toggleInspector}
      recentAction={recentAction}
      searchDisabled={true}
      selectedNode={selectedNode}
      settingsDisabled={true}
      stage={stage}
      workspaceName={activeWorkspace?.name ?? null}
      workspaceRootDir={activeWorkspace?.rootDir ?? null}
    />
  );
};
