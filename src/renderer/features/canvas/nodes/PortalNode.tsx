import { useEffect, useRef, useState } from 'react';
import type { OpenWeaveShellBridge } from '../../../../shared/ipc/contracts';
import type { PortalNodeInput } from '../../../../shared/ipc/schemas';
import { useCanvasStore } from '../canvas.store';

interface PortalNodeProps {
  workspaceId: string;
  node: PortalNodeInput;
  onChange: (patch: Partial<Pick<PortalNodeInput, 'x' | 'y' | 'url'>>) => void;
}

const getPortalBridge = (): OpenWeaveShellBridge['portal'] => {
  const shell = (window as Window & { openweaveShell?: OpenWeaveShellBridge }).openweaveShell;
  if (!shell) {
    throw new Error('openweaveShell bridge is unavailable');
  }
  return shell.portal;
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Portal action failed';
};

export const PortalNode = ({ workspaceId, node, onChange }: PortalNodeProps): JSX.Element => {
  const containerRef = useRef<HTMLElement | null>(null);
  const [portalId, setPortalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const connectModeActive = useCanvasStore((storeState) => storeState.connectModeActive);

  useEffect(() => {
    let cancelled = false;
    setPortalId(null);
    setErrorMessage(null);

    setLoading(true);
    void getPortalBridge()
      .loadPortal({
        workspaceId,
        nodeId: node.id,
        url: node.url
      })
      .then((response) => {
        if (cancelled) {
          return;
        }
        setPortalId(response.portal.id);
        if (response.portal.url !== node.url) {
          onChange({ url: response.portal.url });
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setErrorMessage(toErrorMessage(error));
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, node.id, node.url, onChange]);

  useEffect(() => {
    let animationFrameId: number | null = null;
    let lastPayload = '';
    let disposed = false;
    const syncBounds = (): void => {
      if (disposed) {
        return;
      }
      const element = containerRef.current;
      if (element) {
        const rect = element.getBoundingClientRect();
        const viewportVisible =
          rect.width > 1 &&
          rect.height > 1 &&
          rect.bottom > 0 &&
          rect.right > 0 &&
          rect.left < window.innerWidth &&
          rect.top < window.innerHeight;
        const scaleX = element.offsetWidth > 0 ? rect.width / element.offsetWidth : 1;
        const scaleY = element.offsetHeight > 0 ? rect.height / element.offsetHeight : scaleX;
        const scale = Number.isFinite(scaleX) && scaleX > 0
          ? scaleX
          : Number.isFinite(scaleY) && scaleY > 0
            ? scaleY
            : 1;
        const bounds = {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.max(0, Math.round(rect.width)),
          height: Math.max(0, Math.round(rect.height)),
          visible: viewportVisible && !connectModeActive,
          scale: Math.round(scale * 1000) / 1000
        };
        const payload = JSON.stringify(bounds);
        if (payload !== lastPayload) {
          lastPayload = payload;
          void getPortalBridge().setPortalBounds({
            workspaceId,
            nodeId: node.id,
            bounds
          });
        }
      }
      animationFrameId = window.requestAnimationFrame(syncBounds);
    };
    syncBounds();
    return () => {
      disposed = true;
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
      void getPortalBridge().setPortalBounds({
        workspaceId,
        nodeId: node.id,
        bounds: {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          visible: false,
          scale: 1
        }
      });
    };
  }, [workspaceId, node.id, connectModeActive]);

  return (
    <section className="ow-portal-node" data-testid={`portal-node-${node.id}`} ref={containerRef}>
      <div aria-hidden="true" className="ow-portal-node__live-placeholder" data-testid={`portal-live-surface-${node.id}`} />
      {connectModeActive ? (
        <div
          aria-hidden="true"
          className="ow-portal-node__connect-blocker"
          data-testid={`portal-connect-blocker-${node.id}`}
        />
      ) : null}
      {loading && (
        <div className="ow-portal-node__status" data-testid={`portal-loading-${node.id}`}>
          Loading...
        </div>
      )}
      {errorMessage && (
        <p className="ow-portal-node__error" data-testid={`portal-error-${node.id}`}>
          {errorMessage}
        </p>
      )}
    </section>
  );
};
