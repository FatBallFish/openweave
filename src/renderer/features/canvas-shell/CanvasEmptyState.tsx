import { useI18n } from '../../i18n/provider';

interface CanvasEmptyAction {
  label: string;
  hotkey: string;
  onClick: () => void;
}

interface CanvasEmptyStateProps {
  actions: CanvasEmptyAction[];
}

export const CanvasEmptyState = ({ actions }: CanvasEmptyStateProps): JSX.Element => {
  const { t } = useI18n();

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
        <p className="ow-canvas-empty-state__eyebrow">{t('canvasEmpty.eyebrow')}</p>
        <h3>{t('canvasEmpty.title')}</h3>
        <p className="ow-canvas-empty-state__lede">
          {t('canvasEmpty.description')}
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
            <span>{t('canvasEmpty.primarySurface')}</span>
            <strong>{t('canvasEmpty.canvasFirst')}</strong>
          </div>
          <div>
            <span>{t('canvasEmpty.starterFlow')}</span>
            <strong>{t('canvasEmpty.terminalContext')}</strong>
          </div>
          <div>
            <span>{t('canvasEmpty.hotkeys')}</span>
            <strong>1-5 and /</strong>
          </div>
        </div>
        <div className="ow-canvas-empty-state__recipes">
          <article>
            <strong>{t('canvasEmpty.debugRepo')}</strong>
            <p>{t('canvasEmpty.debugRepoDescription')}</p>
          </article>
          <article>
            <strong>{t('canvasEmpty.exploreSite')}</strong>
            <p>{t('canvasEmpty.exploreSiteDescription')}</p>
          </article>
        </div>
      </div>
    </div>
  );
};
