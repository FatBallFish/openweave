import { useI18n } from '../../i18n/provider';

interface CanvasEmptyAction {
  label: string;
  hotkey: string;
  onClick: () => void;
}

interface CanvasEmptyStateProps {
  actions: CanvasEmptyAction[];
  onClose?: () => void;
}

export const CanvasEmptyState = ({ actions, onClose }: CanvasEmptyStateProps): JSX.Element => {
  const { t } = useI18n();

  return (
    <div className="ow-canvas-empty-state" data-testid="canvas-empty-state">
      <div className="ow-canvas-empty-state__card" data-testid="canvas-empty">
        {onClose ? (
          <button
            aria-label={t('canvasEmpty.close')}
            className="ow-canvas-empty-state__close"
            onClick={onClose}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16">
              <path d="M18 6L6 18M6 6l12 12" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
        ) : null}
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
