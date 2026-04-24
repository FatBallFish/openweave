import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { canvasStore, useCanvasStore } from './canvas.store';
import { useI18n } from '../../i18n/provider';

const PRESET_COLORS = [
  '#fef3c7', '#dbeafe', '#dcfce7', '#fce7f3',
  '#f3e8ff', '#ffedd5', '#e5e7eb', '#ffffff',
];

const HEADING_ACTIONS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;

type ToolbarAction =
  | 'bold' | 'italic' | 'strikethrough' | 'code' | 'codeblock'
  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  | 'todo' | 'bullet' | 'ordered' | 'image';

const MD_BUTTONS: { action: ToolbarAction; label: string; display: string }[] = [
  { action: 'bold', label: 'Bold', display: 'B' },
  { action: 'italic', label: 'Italic', display: 'I' },
  { action: 'strikethrough', label: 'Strikethrough', display: 'S' },
  { action: 'code', label: 'Inline code', display: '<>' },
  { action: 'codeblock', label: 'Code block', display: '{ }' },
  { action: 'todo', label: 'Todo list', display: '☐' },
  { action: 'bullet', label: 'Bullet list', display: '•' },
  { action: 'ordered', label: 'Ordered list', display: '1.' },
  { action: 'image', label: 'Image', display: '🖼' },
];

const TrashIcon = (): JSX.Element => (
  <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14">
    <path
      d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h13M10 11v6M14 11v6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

export const NoteToolbar = (): JSX.Element | null => {
  const { t } = useI18n();
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const graphSnapshot = useCanvasStore((s) => s.graphSnapshot);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return graphSnapshot.nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [selectedNodeId, graphSnapshot.nodes]);

  const isNote = selectedNode?.componentType === 'builtin.note';
  const nodeState = selectedNode?.state ?? {};

  const backgroundColor =
    typeof nodeState.backgroundColor === 'string'
      ? nodeState.backgroundColor
      : '#fef3c7';
  const opacity =
    typeof nodeState.opacity === 'number' ? nodeState.opacity : 1;
  const fontSize =
    typeof nodeState.fontSize === 'number' ? nodeState.fontSize : 13;

  const [colorOpen, setColorOpen] = useState(false);
  const [headingOpen, setHeadingOpen] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);

  // Close popovers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (colorRef.current && !colorRef.current.contains(target)) {
        setColorOpen(false);
      }
      if (headingRef.current && !headingRef.current.contains(target)) {
        setHeadingOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const updateStyle = useCallback(
    (patch: { backgroundColor?: string; opacity?: number; fontSize?: number }) => {
      if (!selectedNodeId) return;
      void canvasStore.updateNoteNode(selectedNodeId, patch);
    },
    [selectedNodeId]
  );

  const [opacityDraft, setOpacityDraft] = useState<string | null>(null);
  const [fontSizeDraft, setFontSizeDraft] = useState<string | null>(null);

  const dispatchMarkdownAction = useCallback(
    (action: ToolbarAction) => {
      if (!selectedNodeId) return;
      window.dispatchEvent(
        new CustomEvent('openweave:note-toolbar-action', {
          detail: { nodeId: selectedNodeId, action },
        })
      );
    },
    [selectedNodeId]
  );

  const applyOpacity = useCallback(
    (raw: string) => {
      const val = parseInt(raw, 10);
      if (!Number.isNaN(val)) {
        const clamped = Math.min(100, Math.max(30, val));
        updateStyle({ opacity: clamped / 100 });
      }
      setOpacityDraft(null);
    },
    [updateStyle]
  );

  const applyFontSize = useCallback(
    (raw: string) => {
      const val = parseInt(raw, 10);
      if (!Number.isNaN(val)) {
        const clamped = Math.min(30, Math.max(5, val));
        updateStyle({ fontSize: clamped });
      }
      setFontSizeDraft(null);
    },
    [updateStyle]
  );

  const handleDelete = useCallback(() => {
    if (!selectedNodeId) return;
    void canvasStore.deleteNodes([selectedNodeId]);
  }, [selectedNodeId]);

  if (!isNote || !selectedNodeId) {
    return null;
  }

  return (
    <div className="ow-note-toolbar" data-testid="note-toolbar">
      {/* Background color popover */}
      <div className="ow-note-toolbar__group" ref={colorRef}>
        <button
          className="ow-note-toolbar__color-trigger"
          onClick={() => setColorOpen((v) => !v)}
          style={{ backgroundColor }}
          title="Background color"
          type="button"
          aria-haspopup="true"
          aria-expanded={colorOpen}
        />
        {colorOpen && (
          <div className="ow-note-toolbar__popover ow-note-toolbar__popover--color">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                className={`ow-note-toolbar__color-swatch${
                  backgroundColor === color ? ' ow-note-toolbar__color-swatch--active' : ''
                }`}
                onClick={() => {
                  updateStyle({ backgroundColor: color });
                  setColorOpen(false);
                }}
                style={{ backgroundColor: color }}
                type="button"
                aria-label={`Background color ${color}`}
              />
            ))}
            <input
              className="ow-note-toolbar__color-input"
              onChange={(e) => {
                updateStyle({ backgroundColor: e.target.value });
                setColorOpen(false);
              }}
              title="Custom color"
              type="color"
              value={backgroundColor}
            />
          </div>
        )}
      </div>

      <div className="ow-note-toolbar__divider" />

      {/* Opacity number input */}
      <div className="ow-note-toolbar__group ow-note-toolbar__group--input">
        <span className="ow-note-toolbar__label">{t('noteToolbar.opacity')}</span>
        <input
          className="ow-note-toolbar__number"
          onBlur={(e) => applyOpacity(e.target.value)}
          onChange={(e) => setOpacityDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              applyOpacity((e.target as HTMLInputElement).value);
            }
          }}
          type="number"
          value={opacityDraft !== null ? opacityDraft : Math.round(opacity * 100)}
        />
        <span className="ow-note-toolbar__suffix">%</span>
      </div>

      <div className="ow-note-toolbar__divider" />

      {/* Font size number input */}
      <div className="ow-note-toolbar__group ow-note-toolbar__group--input">
        <span className="ow-note-toolbar__label">{t('noteToolbar.fontSize')}</span>
        <input
          className="ow-note-toolbar__number"
          onBlur={(e) => applyFontSize(e.target.value)}
          onChange={(e) => setFontSizeDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              applyFontSize((e.target as HTMLInputElement).value);
            }
          }}
          type="number"
          value={fontSizeDraft !== null ? fontSizeDraft : fontSize}
        />
        <span className="ow-note-toolbar__suffix">px</span>
      </div>

      <div className="ow-note-toolbar__divider" />

      {/* Markdown actions */}
      <div className="ow-note-toolbar__group ow-note-toolbar__group--md">
        {/* Heading dropdown */}
        <div className="ow-note-toolbar__dropdown" ref={headingRef}>
          <button
            className="ow-note-toolbar__btn"
            onClick={() => setHeadingOpen((v) => !v)}
            title="Heading"
            type="button"
            aria-haspopup="true"
            aria-expanded={headingOpen}
          >
            H
          </button>
          {headingOpen && (
            <div className="ow-note-toolbar__popover ow-note-toolbar__popover--heading">
              {HEADING_ACTIONS.map((h) => (
                <button
                  key={h}
                  className="ow-note-toolbar__dropdown-item"
                  onClick={() => {
                    dispatchMarkdownAction(h as ToolbarAction);
                    setHeadingOpen(false);
                  }}
                  type="button"
                >
                  {h.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        {MD_BUTTONS.map(({ action, label, display }) => (
          <button
            key={action}
            className="ow-note-toolbar__btn"
            onClick={() => dispatchMarkdownAction(action)}
            title={label}
            type="button"
          >
            {display === 'I' ? <i>I</i> : display === 'S' ? <s>S</s> : display}
          </button>
        ))}
      </div>

      <div className="ow-note-toolbar__divider" />

      {/* Delete */}
      <div className="ow-note-toolbar__group">
        <button
          className="ow-note-toolbar__btn ow-note-toolbar__btn--danger"
          onClick={handleDelete}
          title="Delete note"
          type="button"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
};
