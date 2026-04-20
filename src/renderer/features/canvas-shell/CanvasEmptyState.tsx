interface CanvasEmptyAction {
  label: string;
  hotkey: string;
  onClick: () => void;
}

interface CanvasEmptyStateProps {
  actions: CanvasEmptyAction[];
}

export const CanvasEmptyState = ({ actions }: CanvasEmptyStateProps): JSX.Element => {
  return (
    <div className="ow-canvas-empty-state" data-testid="canvas-empty-state">
      <div aria-hidden="true" className="ow-canvas-empty-state__edge-sketch">
        <span className="ow-canvas-empty-state__ghost ow-canvas-empty-state__ghost--context" />
        <span className="ow-canvas-empty-state__ghost ow-canvas-empty-state__ghost--plan" />
        <span className="ow-canvas-empty-state__ghost ow-canvas-empty-state__ghost--runtime" />
        <span className="ow-canvas-empty-state__ghost ow-canvas-empty-state__ghost--result" />
        <svg viewBox="0 0 600 260">
          <path d="M116 86C180 72 242 72 314 120" />
          <path d="M300 136C362 158 420 170 498 162" />
          <path d="M132 174C206 184 254 174 300 140" />
        </svg>
      </div>

      <div className="ow-canvas-empty-state__card" data-testid="canvas-empty">
        <p className="ow-canvas-empty-state__eyebrow">Workflow kickoff</p>
        <h3>Start with a terminal</h3>
        <p className="ow-canvas-empty-state__lede">
          Then add context around it with notes, files, portals, and pinned results.
        </p>
        <div className="ow-canvas-empty-state__actions">
          {actions.map((action) => (
            <button
              className="ow-canvas-empty-state__action"
              data-testid={`canvas-empty-action-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
              key={action.label}
              onClick={action.onClick}
              type="button"
            >
              <strong>{action.label}</strong>
              <span>{action.hotkey}</span>
            </button>
          ))}
        </div>
        <div className="ow-canvas-empty-state__signal-strip">
          <div>
            <span>Primary surface</span>
            <strong>Canvas first</strong>
          </div>
          <div>
            <span>Starter flow</span>
            <strong>Terminal + context</strong>
          </div>
          <div>
            <span>Hotkeys</span>
            <strong>1-5 and /</strong>
          </div>
        </div>
        <div className="ow-canvas-empty-state__recipes">
          <article>
            <strong>Debug a repo</strong>
            <p>Inspect files, run commands, and capture fixes.</p>
          </article>
          <article>
            <strong>Explore a website</strong>
            <p>Open a portal, inspect structure, and pin findings.</p>
          </article>
        </div>
      </div>
    </div>
  );
};
