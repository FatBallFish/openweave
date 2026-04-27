import { useEffect } from 'react';
import { settingsStore, type ShortcutActionId } from '../workbench/settings.store';

export type CanvasShortcutAction =
  | 'open-command-palette'
  | 'open-quick-add'
  | 'toggle-inspector'
  | 'add-terminal'
  | 'add-note'
  | 'add-portal'
  | 'add-file-tree'
  | 'add-text'
  | 'escape'
  | 'delete-selected'
  | 'undo'
  | 'redo'
  | 'toggle-connect-mode';

interface CanvasShortcutLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
}

interface UseCanvasShortcutsOptions {
  enabled?: boolean;
  onOpenCommandPalette: () => void;
  onOpenQuickAdd: () => void;
  onToggleInspector: () => void;
  onAddTerminal: () => void;
  onAddNote: () => void;
  onAddPortal: () => void;
  onAddFileTree: () => void;
  onAddText: () => void;
  onEscape: () => void;
  onDeleteSelected: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleConnectMode?: () => void;
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!target || typeof target !== 'object') {
    return false;
  }
  const candidate = target as { tagName?: string; isContentEditable?: boolean };
  const tagName = candidate.tagName?.toUpperCase();
  return (
    candidate.isContentEditable === true ||
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    tagName === 'BUTTON'
  );
};

const matchesBinding = (
  event: CanvasShortcutLike,
  binding: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }
): boolean => {
  const eventKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const bindingKey = binding.key.length === 1 ? binding.key.toLowerCase() : binding.key;
  if (eventKey !== bindingKey) return false;
  const hasBindingMod = binding.ctrlKey || binding.metaKey;
  const hasEventMod = event.ctrlKey || event.metaKey;
  if (hasBindingMod !== hasEventMod) return false;
  if (event.shiftKey !== binding.shiftKey) return false;
  if (event.altKey !== binding.altKey) return false;
  return true;
};

export const getCanvasShortcutAction = (
  event: CanvasShortcutLike
): CanvasShortcutAction | null => {
  if (isEditableTarget(event.target)) {
    return null;
  }

  const bindings = settingsStore.getState().shortcutBindings;

  // Delete/Backspace: check the binding first, also handle Backspace as fallback
  const deleteBinding = bindings['delete-selected'];
  if (matchesBinding(event, deleteBinding) || (event.key === 'Backspace' && deleteBinding.key === 'Delete')) {
    return 'delete-selected';
  }

  // Undo: also check for bare ctrl/meta+z as fallback
  if (matchesBinding(event, bindings['undo']) || (event.key.toLowerCase() === 'z' && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey)) {
    return 'undo';
  }

  for (const [actionId, binding] of Object.entries(bindings) as [ShortcutActionId, typeof bindings[string]][]) {
    if (actionId === 'delete-selected' || actionId === 'undo') continue; // already handled
    if (matchesBinding(event, binding)) {
      return actionId;
    }
  }

  return null;
};

export const useCanvasShortcuts = ({
  enabled = true,
  onOpenCommandPalette,
  onOpenQuickAdd,
  onToggleInspector,
  onAddTerminal,
  onAddNote,
  onAddPortal,
  onAddFileTree,
  onAddText,
  onEscape,
  onDeleteSelected,
  onUndo,
  onRedo,
  onToggleConnectMode
}: UseCanvasShortcutsOptions): void => {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      const action = getCanvasShortcutAction(event);
      if (!action) {
        return;
      }

      event.preventDefault();

      switch (action) {
        case 'open-command-palette':
          onOpenCommandPalette();
          return;
        case 'open-quick-add':
          onOpenQuickAdd();
          return;
        case 'toggle-inspector':
          onToggleInspector();
          return;
        case 'add-terminal':
          onAddTerminal();
          return;
        case 'add-note':
          onAddNote();
          return;
        case 'add-portal':
          onAddPortal();
          return;
        case 'add-file-tree':
          onAddFileTree();
          return;
        case 'add-text':
          onAddText();
          return;
        case 'escape':
          onEscape();
          return;
        case 'delete-selected':
          onDeleteSelected();
          return;
        case 'undo':
          onUndo();
          return;
        case 'redo':
          onRedo();
          return;
        case 'toggle-connect-mode':
          onToggleConnectMode?.();
          return;
        default:
          return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    enabled,
    onAddFileTree,
    onAddNote,
    onAddPortal,
    onAddTerminal,
    onAddText,
    onEscape,
    onOpenCommandPalette,
    onOpenQuickAdd,
    onToggleInspector,
    onDeleteSelected,
    onUndo,
    onRedo,
    onToggleConnectMode
  ]);
};
