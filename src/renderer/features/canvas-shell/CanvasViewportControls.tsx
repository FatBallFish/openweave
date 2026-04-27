import { useReactFlow } from '@xyflow/react';
import { useI18n } from '../../i18n/provider';
import { computeSmartFitViewport } from './canvas-fit-view';

export const CanvasViewportControls = (): JSX.Element => {
  const { t } = useI18n();
  const { getViewport, setViewport, getNodes } = useReactFlow();

  const icon = (path: string) => (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16">
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );

  const handleZoomIn = () => {
    const { x, y, zoom } = getViewport();
    const newZoom = Math.min(zoom * 1.15, 2);
    setViewport({ x, y, zoom: newZoom }, { duration: 0 });
  };

  const handleZoomOut = () => {
    const { x, y, zoom } = getViewport();
    const newZoom = Math.max(zoom * 0.85, 0.4);
    setViewport({ x, y, zoom: newZoom }, { duration: 0 });
  };

  const handleFitView = () => {
    const container = document.querySelector('.ow-canvas-shell__flow');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const nodes = getNodes();
    const viewport = computeSmartFitViewport(nodes, rect.width, rect.height);

    if (viewport) {
      setViewport(viewport, { duration: 180 });
    }
  };

  return (
    <div className="ow-canvas-viewport-controls" data-testid="canvas-viewport-controls">
      <button
        aria-label={t('canvas.zoomIn')}
        className="ow-canvas-viewport-controls__btn"
        data-testid="canvas-zoom-in"
        onClick={handleZoomIn}
        title={t('canvas.zoomIn')}
        type="button"
      >
        {icon('M12 5v14M5 12h14')}
      </button>
      <button
        aria-label={t('canvas.fitView')}
        className="ow-canvas-viewport-controls__btn"
        data-testid="canvas-fit-view"
        onClick={handleFitView}
        title={t('canvas.fitView')}
        type="button"
      >
        {icon('M8 4H4v4M20 8V4h-4M4 16v4h4M16 20h4v-4')}
      </button>
      <button
        aria-label={t('canvas.zoomOut')}
        className="ow-canvas-viewport-controls__btn"
        data-testid="canvas-zoom-out"
        onClick={handleZoomOut}
        title={t('canvas.zoomOut')}
        type="button"
      >
        {icon('M5 12h14')}
      </button>
    </div>
  );
};
