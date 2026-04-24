import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { canvasStore } from '../../canvas/canvas.store';
import type { BuiltinHostProps } from './types';

type ViewMode = 'edit' | 'preview';

const DEBOUNCE_FILE_WRITE_MS = 500;

interface NoteState {
  content: string;
  viewMode: ViewMode;
  backgroundColor: string;
  opacity: number;
  fontSize: number;
}

const getNoteState = (nodeState: Record<string, unknown>): NoteState => ({
  content: typeof nodeState.content === 'string' ? nodeState.content : '',
  viewMode: nodeState.viewMode === 'preview' ? 'preview' : 'edit',
  backgroundColor: typeof nodeState.backgroundColor === 'string' ? nodeState.backgroundColor : '#fef3c7',
  opacity: typeof nodeState.opacity === 'number' ? nodeState.opacity : 0.7,
  fontSize: typeof nodeState.fontSize === 'number' ? nodeState.fontSize : 10,
});

const wrapSelection = (
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  defaultText?: string
): void => {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end);
  const replacement = selected.length > 0 ? `${before}${selected}${after}` : `${before}${defaultText ?? ''}${after}`;
  const newValue = value.slice(0, start) + replacement + value.slice(end);
  textarea.value = newValue;

  const cursorPos = selected.length > 0
    ? start + replacement.length
    : start + before.length + (defaultText ? defaultText.length : 0);
  textarea.selectionStart = cursorPos;
  textarea.selectionEnd = cursorPos;
  textarea.focus();

  // Trigger change event so React state updates
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
};

const insertAtCursor = (
  textarea: HTMLTextAreaElement,
  text: string
): void => {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const newValue = value.slice(0, start) + text + value.slice(end);
  textarea.value = newValue;
  const cursorPos = start + text.length;
  textarea.selectionStart = cursorPos;
  textarea.selectionEnd = cursorPos;
  textarea.focus();
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
};

const insertLinePrefix = (
  textarea: HTMLTextAreaElement,
  prefix: string
): void => {
  const start = textarea.selectionStart;
  const value = textarea.value;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const newValue = value.slice(0, lineStart) + prefix + value.slice(lineStart);
  textarea.value = newValue;
  const cursorPos = lineStart + prefix.length;
  textarea.selectionStart = cursorPos;
  textarea.selectionEnd = cursorPos;
  textarea.focus();
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
};

export const NoteHost = ({ node, workspaceId }: BuiltinHostProps): JSX.Element => {
  const noteState = getNoteState(node.state);
  const [content, setContent] = useState(noteState.content);
  const [viewMode, setViewMode] = useState<ViewMode>(noteState.viewMode);
  const [backgroundColor, setBackgroundColor] = useState(noteState.backgroundColor);
  const [opacity, setOpacity] = useState(noteState.opacity);
  const [fontSize, setFontSize] = useState(noteState.fontSize);
  const [isRenaming, setIsRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState(node.title);
  const [renameError, setRenameError] = useState<string | null>(null);

  const fileWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stickyRef = useRef<HTMLElement>(null);
  const contentRef = useRef(content);
  const lastSyncedToGraphRef = useRef(content);

  // Intercept wheel events inside the note at the capture phase so that
  // they never reach the canvas pane handler which calls preventDefault().
  useEffect(() => {
    const el = stickyRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      // Do not let the event propagate to the canvas pane where
      // ReactFlow has registered a listener that does preventDefault().
      e.stopPropagation();
    };
    // Capture phase: intercept before the event reaches any descendant
    // or the pane listener.
    el.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => el.removeEventListener('wheel', handleWheel, { capture: true });
  }, []);

  // Sync local state from graph node state (for undo/redo / external updates)
  useEffect(() => {
    const next = getNoteState(node.state);
    if (next.content !== contentRef.current) {
      setContent(next.content);
      contentRef.current = next.content;
      lastSyncedToGraphRef.current = next.content;
    }
    setViewMode(next.viewMode);
    setBackgroundColor(next.backgroundColor);
    setOpacity(next.opacity);
    setFontSize(next.fontSize);
  }, [node.state.content, node.state.viewMode, node.state.backgroundColor, node.state.opacity, node.state.fontSize]);

  // Update title when node title changes externally
  useEffect(() => {
    if (!isRenaming) {
      setTitleDraft(node.title);
    }
  }, [node.title, isRenaming]);

  // Debounced file write
  const scheduleFileWrite = useCallback((nextContent: string) => {
    if (fileWriteTimerRef.current) {
      clearTimeout(fileWriteTimerRef.current);
    }
    fileWriteTimerRef.current = setTimeout(async () => {
      const shell = (window as any).openweaveShell;
      if (shell?.notes) {
        try {
          await shell.notes.writeFile({
            workspaceId,
            nodeId: node.id,
            title: node.title,
            content: nextContent
          });
        } catch {
          // File write failure is non-blocking
        }
      }
    }, DEBOUNCE_FILE_WRITE_MS);
  }, [workspaceId, node.id, node.title]);

  // Listen for toolbar markdown actions
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { nodeId: string; action: string };
      if (detail.nodeId !== node.id) return;

      const textarea = textareaRef.current;
      if (!textarea) return;

      switch (detail.action) {
        case 'bold':
          wrapSelection(textarea, '**', '**');
          break;
        case 'italic':
          wrapSelection(textarea, '*', '*');
          break;
        case 'strikethrough':
          wrapSelection(textarea, '~~', '~~');
          break;
        case 'code':
          wrapSelection(textarea, '`', '`');
          break;
        case 'codeblock':
          wrapSelection(textarea, '```\n', '\n```', 'code');
          break;
        case 'h1':
          insertLinePrefix(textarea, '# ');
          break;
        case 'h2':
          insertLinePrefix(textarea, '## ');
          break;
        case 'h3':
          insertLinePrefix(textarea, '### ');
          break;
        case 'h4':
          insertLinePrefix(textarea, '#### ');
          break;
        case 'h5':
          insertLinePrefix(textarea, '##### ');
          break;
        case 'h6':
          insertLinePrefix(textarea, '###### ');
          break;
        case 'todo':
          insertLinePrefix(textarea, '- [ ] ');
          break;
        case 'bullet':
          insertLinePrefix(textarea, '- ');
          break;
        case 'ordered':
          insertLinePrefix(textarea, '1. ');
          break;
        case 'image':
          insertAtCursor(textarea, '\n![alt](url)\n');
          break;
      }

      // Sync content change
      const newValue = textarea.value;
      setContent(newValue);
      contentRef.current = newValue;
      scheduleFileWrite(newValue);
    };

    window.addEventListener('openweave:note-toolbar-action', handler);
    return () => window.removeEventListener('openweave:note-toolbar-action', handler);
  }, [node.id, scheduleFileWrite]);

  const flushGraphSync = useCallback(() => {
    if (contentRef.current !== lastSyncedToGraphRef.current) {
      void canvasStore.updateNoteNode(node.id, { contentMd: contentRef.current });
      lastSyncedToGraphRef.current = contentRef.current;
    }
  }, [node.id]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (fileWriteTimerRef.current) {
        clearTimeout(fileWriteTimerRef.current);
      }
      // Flush file write unconditionally on unmount
      const shell = (window as any).openweaveShell;
      if (shell?.notes) {
        shell.notes.writeFile({
          workspaceId,
          nodeId: node.id,
          title: node.title,
          content: contentRef.current
        }).catch(() => {});
      }
      // Flush graph sync
      if (contentRef.current !== lastSyncedToGraphRef.current) {
        void canvasStore.updateNoteNode(node.id, { contentMd: contentRef.current });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContentChange = useCallback((value: string) => {
    setContent(value);
    contentRef.current = value;
    scheduleFileWrite(value);
  }, [scheduleFileWrite]);

  const handleBlur = useCallback(() => {
    flushGraphSync();
  }, [flushGraphSync]);

  const handleStartRename = useCallback(() => {
    setIsRenaming(true);
    setTitleDraft(node.title);
    setRenameError(null);
    setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 0);
  }, [node.title]);

  const handleRenameCommit = useCallback(async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === node.title) {
      setIsRenaming(false);
      setRenameError(null);
      return;
    }

    try {
      await canvasStore.renameNoteNode(node.id, trimmed);
      setIsRenaming(false);
      setRenameError(null);
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : 'Rename failed');
    }
  }, [titleDraft, node.id, node.title]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleRenameCommit();
    } else if (e.key === 'Escape') {
      setIsRenaming(false);
      setRenameError(null);
    }
  }, [handleRenameCommit]);

  const toggleViewMode = useCallback(() => {
    const nextMode: ViewMode = viewMode === 'edit' ? 'preview' : 'edit';
    setViewMode(nextMode);
    void canvasStore.updateNoteNode(node.id, { viewMode: nextMode });
  }, [viewMode, node.id]);

  const stickyStyle: React.CSSProperties = {
    backgroundColor,
    opacity,
  };

  const editorStyle: React.CSSProperties = {
    fontSize: `${fontSize}px`,
  };

  return (
    <article
      ref={stickyRef}
      className="ow-note-sticky"
      data-node-kind="note"
      data-testid={`note-sticky-${node.id}`}
      style={stickyStyle}
    >
      <header
        className={`ow-note-sticky__topbar${isRenaming ? ' ow-note-sticky__topbar--renaming' : ''}`}
        onDoubleClick={handleStartRename}
      >
        {isRenaming ? (
          <>
            <input
              ref={titleInputRef}
              className="ow-note-sticky__title-input"
              data-testid={`note-sticky-title-input-${node.id}`}
              onBlur={() => void handleRenameCommit()}
              onChange={(e) => setTitleDraft(e.currentTarget.value)}
              onKeyDown={handleRenameKeyDown}
              value={titleDraft}
            />
            {renameError && (
              <span className="ow-note-sticky__rename-error">{renameError}</span>
            )}
          </>
        ) : (
          <>
            <span
              className="ow-note-sticky__title"
              data-testid={`note-sticky-title-${node.id}`}
              title="Double-click to rename"
            >
              {node.title}
            </span>
            <button
              className={`ow-note-sticky__view-toggle${viewMode === 'preview' ? ' ow-note-sticky__view-toggle--active' : ''}`}
              data-testid={`note-sticky-view-toggle-${node.id}`}
              onClick={toggleViewMode}
              onMouseDown={(e) => e.preventDefault()}
              title={viewMode === 'edit' ? 'Preview' : 'Edit'}
              type="button"
            >
              <span className="ow-note-sticky__view-toggle__track">
                <span className="ow-note-sticky__view-toggle__thumb" />
              </span>
            </button>
          </>
        )}
      </header>

      <div className="ow-note-sticky__body nowheel">
        {viewMode === 'edit' ? (
          <textarea
            ref={textareaRef}
            aria-label="Markdown note"
            className="ow-note-sticky__editor nowheel"
            data-testid={`note-sticky-editor-${node.id}`}
            onChange={(event) => handleContentChange(event.currentTarget.value)}
            onBlur={handleBlur}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                e.currentTarget.select();
              }
            }}
            spellCheck={false}
            style={editorStyle}
            value={content}
          />
        ) : (
          <div
            className="ow-note-sticky__preview nowheel"
            data-testid={`note-sticky-preview-${node.id}`}
            style={editorStyle}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content || '*Empty note*'}
            </ReactMarkdown>
          </div>
        )}
      </div>

      <footer className="ow-note-sticky__statusbar" />
    </article>
  );
};
