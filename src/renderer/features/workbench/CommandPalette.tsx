import { useEffect, useMemo, useRef, useState } from 'react';

export interface CommandPaletteItem {
  id: string;
  label: string;
  hint?: string;
  section: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  mode: 'command' | 'quick-add';
  items: CommandPaletteItem[];
  onClose: () => void;
  showTrigger?: boolean;
  onOpen?: () => void;
}

export const CommandPalette = ({
  open,
  mode,
  items,
  onClose,
  showTrigger = true,
  onOpen
}: CommandPaletteProps): JSX.Element => {
  const [query, setQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }

    searchInputRef.current?.focus();
  }, [mode, open]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (normalizedQuery.length === 0) {
      return items;
    }

    return items.filter((item) => {
      const haystack = [item.label, item.section, item.hint]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [items, normalizedQuery]);
  const sections = Array.from(new Set(filteredItems.map((item) => item.section)));

  return (
    <>
      {showTrigger ? (
        <button data-testid="command-palette-trigger" onClick={onOpen} type="button">
          {mode === 'quick-add' ? 'Quick add' : 'Command palette'}
        </button>
      ) : null}

      {open ? (
        <div
          className="ow-command-palette-backdrop"
          data-testid="command-palette-backdrop"
          onClick={onClose}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="ow-command-palette"
            data-testid="command-palette"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                onClose();
              }
            }}
            role="dialog"
          >
            <div className="ow-command-palette__header">
              <div>
                <p className="ow-command-palette__eyebrow">Workflow controls</p>
                <h2>{mode === 'quick-add' ? 'Quick add' : 'Command palette'}</h2>
              </div>
              <button
                className="ow-toolbar-button"
                data-testid="command-palette-close"
                onClick={onClose}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="ow-command-palette__search">
              <label className="ow-command-palette__search-field">
                <span>Find actions</span>
                <input
                  aria-label="Filter command palette items"
                  className="ow-command-palette__search-input"
                  data-testid="command-palette-search"
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  placeholder={
                    mode === 'quick-add'
                      ? 'Filter node types, shortcuts, or actions'
                      : 'Filter commands, tools, or keyboard hints'
                  }
                  ref={searchInputRef}
                  type="text"
                  value={query}
                />
              </label>
              <div className="ow-command-palette__search-meta">
                <span>{filteredItems.length} results</span>
                <span>{mode === 'quick-add' ? '1-5 or /' : 'Cmd/Ctrl+K'}</span>
              </div>
            </div>

            {sections.length === 0 ? (
              <div className="ow-command-palette__empty" data-testid="command-palette-empty">
                <strong>No matching actions</strong>
                <p>Try a node type, section name, or keyboard hint.</p>
              </div>
            ) : (
              sections.map((section) => (
                <section className="ow-command-palette__section" key={section}>
                  <div className="ow-command-palette__section-header">
                    <h3>{section}</h3>
                    <span>
                      {filteredItems.filter((item) => item.section === section).length} items
                    </span>
                  </div>
                  <div className="ow-command-palette__items">
                    {filteredItems
                      .filter((item) => item.section === section)
                      .map((item) => (
                        <button
                          className="ow-command-palette__item"
                          data-testid={`command-palette-item-${item.id}`}
                          key={item.id}
                          onClick={item.onSelect}
                          type="button"
                        >
                          <div className="ow-command-palette__item-copy">
                            <strong>{item.label}</strong>
                            <small>{item.section}</small>
                          </div>
                          {item.hint ? <span>{item.hint}</span> : null}
                        </button>
                      ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      ) : null}
    </>
  );
};
