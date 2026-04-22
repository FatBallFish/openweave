import { useEffect } from 'react';

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
  | 'redo';

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
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!target || typeof target !== 'object') {
    return false;
  }

  const candidate = target as {
    tagName?: string;
    isContentEditable?: boolean;
  };
  const tagName = candidate.tagName?.toUpperCase();

  return (
    candidate.isContentEditable === true ||
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    tagName === 'BUTTON'
  );
};

export const getCanvasShortcutAction = (
  event: CanvasShortcutLike
): CanvasShortcutAction | null => {
  if (isEditableTarget(event.target)) {
    return null;
  }

  const key = event.key.toLowerCase();
  const hasPrimaryModifier = event.metaKey || event.ctrlKey;

  if (hasPrimaryModifier && event.shiftKey && key === 'i') {
    return 'toggle-inspector';
  }

  if (hasPrimaryModifier && key === 'k') {
    return 'open-command-palette';
  }

  if (!hasPrimaryModifier && !event.altKey && key === '/') {
    return 'open-quick-add';
  }

  if (!hasPrimaryModifier && !event.altKey && !event.shiftKey) {
    switch (key) {
      case '1':
        return 'add-terminal';
      case '2':
        return 'add-note';
      case '3':
        return 'add-portal';
      case '4':
        return 'add-file-tree';
      case '5':
        return 'add-text';
      case 'escape':
        return 'escape';
      default:
        return null;
    }
  }

  if (key === 'escape') {
    return 'escape';
  }

  if (!hasPrimaryModifier && !event.altKey && !event.shiftKey) {
    if (key === 'backspace' || key === 'delete') {
      return 'delete-selected';
    }
  }

  if (hasPrimaryModifier && !event.altKey && !event.shiftKey && key === 'z') {
    return 'undo';
  }

  if (hasPrimaryModifier && event.shiftKey && !event.altKey && key === 'z') {
    return 'redo';
  }

  if (hasPrimaryModifier && !event.altKey && !event.shiftKey && key === 'y') {
    return 'redo';
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
  onRedo
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
    onRedo
  ]);
};
