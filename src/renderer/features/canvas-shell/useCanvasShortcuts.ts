import { useEffect } from 'react';
import {
  getMergedConfig,
  SHORTCUT_DEFINITIONS,
  type ShortcutConfig
} from '../workbench/shortcuts-config';
import { settingsStore } from '../workbench/settings.store';

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

const configMatchesEvent = (config: ShortcutConfig, event: CanvasShortcutLike): boolean => {
  if (config.key.toLowerCase() !== event.key.toLowerCase()) return false;
  if (config.ctrlKey !== event.ctrlKey) return false;
  if (config.metaKey !== event.metaKey) return false;
  if (config.shiftKey !== event.shiftKey) return false;
  if (config.altKey !== event.altKey) return false;
  return true;
};

export const getCanvasShortcutAction = (
  event: CanvasShortcutLike
): CanvasShortcutAction | null => {
  if (isEditableTarget(event.target)) {
    return null;
  }

  const overrides = settingsStore.getState().shortcuts;

  for (const def of SHORTCUT_DEFINITIONS) {
    const config = getMergedConfig(def.id, overrides);
    if (configMatchesEvent(config, event)) {
      return def.id as CanvasShortcutAction;
    }
    if (def.aliases) {
      for (const alias of def.aliases) {
        if (configMatchesEvent(alias, event)) {
          return def.id as CanvasShortcutAction;
        }
      }
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
