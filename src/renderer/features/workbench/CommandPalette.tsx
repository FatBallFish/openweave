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
  const sections = Array.from(new Set(items.map((item) => item.section)));

  return (
    <>
      {showTrigger ? (
        <button data-testid="command-palette-trigger" onClick={onOpen} type="button">
          {mode === 'quick-add' ? 'Quick add' : 'Command palette'}
        </button>
      ) : null}

      {open ? (
        <div className="ow-command-palette" data-testid="command-palette">
          <div className="ow-command-palette__header">
            <div>
              <p className="ow-command-palette__eyebrow">Workflow controls</p>
              <h2>{mode === 'quick-add' ? 'Quick add' : 'Command palette'}</h2>
            </div>
            <button data-testid="command-palette-close" onClick={onClose} type="button">
              Close
            </button>
          </div>

          {sections.map((section) => (
            <section className="ow-command-palette__section" key={section}>
              <h3>{section}</h3>
              <div className="ow-command-palette__items">
                {items
                  .filter((item) => item.section === section)
                  .map((item) => (
                    <button
                      className="ow-command-palette__item"
                      data-testid={`command-palette-item-${item.id}`}
                      key={item.id}
                      onClick={item.onSelect}
                      type="button"
                    >
                      <strong>{item.label}</strong>
                      {item.hint ? <span>{item.hint}</span> : null}
                    </button>
                  ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </>
  );
};
