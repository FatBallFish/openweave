const railItems = [
  { id: 'home', label: 'Home', glyph: 'OW', active: true },
  { id: 'canvas', label: 'Canvas', glyph: 'C', active: true },
  { id: 'resources', label: 'Resources', glyph: 'R', active: false },
  { id: 'runs', label: 'Runs', glyph: '▶', active: false },
  { id: 'events', label: 'Events', glyph: '•', active: false }
] as const;

export const WorkbenchLeftRail = (): JSX.Element => {
  return (
    <aside className="ow-workbench-left-rail" data-testid="workbench-left-rail">
      <div className="ow-workbench-left-rail__stack">
        {railItems.map((item) => (
          <button
            key={item.id}
            aria-label={item.label}
            className={`ow-workbench-left-rail__item${item.active ? ' is-active' : ''}`}
            data-testid={`workbench-left-rail-item-${item.id}`}
            type="button"
          >
            <span className="ow-workbench-left-rail__glyph">{item.glyph}</span>
          </button>
        ))}
      </div>
      <div className="ow-workbench-left-rail__footer">
        <button
          aria-label="Settings"
          className="ow-workbench-left-rail__item"
          data-testid="workbench-left-rail-item-settings"
          type="button"
        >
          <span className="ow-workbench-left-rail__glyph">⚙</span>
        </button>
      </div>
    </aside>
  );
};
