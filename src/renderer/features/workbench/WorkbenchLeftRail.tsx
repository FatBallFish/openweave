const railItems = [
  { id: 'home', label: 'Home', glyph: 'OW', active: false },
  { id: 'canvas', label: 'Canvas', glyph: 'CN', active: true },
  { id: 'resources', label: 'Resources', glyph: 'RS', active: false },
  { id: 'runs', label: 'Runs', glyph: 'RN', active: false },
  { id: 'events', label: 'Events', glyph: 'EV', active: false }
] as const;

export const WorkbenchLeftRail = (): JSX.Element => {
  return (
    <aside className="ow-workbench-left-rail" data-testid="workbench-left-rail">
      <div className="ow-workbench-left-rail__stack">
        {railItems.map((item) => (
          <button
            key={item.id}
            aria-label={item.label}
            aria-current={item.active ? 'page' : undefined}
            className={`ow-workbench-left-rail__item${item.active ? ' is-active' : ''}`}
            data-testid={`workbench-left-rail-item-${item.id}`}
            title={item.label}
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
          title="Settings"
          type="button"
        >
          <span className="ow-workbench-left-rail__glyph">SY</span>
        </button>
      </div>
    </aside>
  );
};
