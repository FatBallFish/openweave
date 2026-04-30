import { useCallback, useEffect, useRef, useState } from 'react';
import { canvasStore } from '../../canvas/canvas.store';
import { PortalNode } from '../../canvas/nodes/PortalNode';
import { resolveBuiltinNodeState } from '../host-shell/node-state';
import type { BuiltinHostProps } from './types';

export const PortalHost = ({ workspaceId, node }: BuiltinHostProps): JSX.Element => {
  const state = resolveBuiltinNodeState(node);
  const url = typeof node.config.url === 'string' ? node.config.url : 'https://example.com';
  const [pageTitle, setPageTitle] = useState<string>('');
  const [urlDraft, setUrlDraft] = useState(url);
  const articleRef = useRef<HTMLElement>(null);
  const portalSessionId = `${workspaceId}:${node.id}`;

  useEffect(() => {
    setUrlDraft(url);
  }, [url]);

  useEffect(() => {
    const shell = (window as Window & { openweaveShell?: { portal: { onPageTitleChanged: (cb: (e: { portalId: string; title: string }) => void) => () => void; onNewWindow: (cb: (e: { parentPortalId: string; url: string }) => void) => () => void } } }).openweaveShell;
    if (!shell?.portal?.onPageTitleChanged) return;
    const unsubscribe = shell.portal.onPageTitleChanged((event) => {
      if (event.portalId !== portalSessionId) {
        return;
      }
      setPageTitle(event.title);
    });
    return unsubscribe;
  }, [portalSessionId]);

  useEffect(() => {
    const shell = (window as Window & { openweaveShell?: { portal: { onUrlChanged: (cb: (e: { portalId: string; url: string }) => void) => () => void } } }).openweaveShell;
    if (!shell?.portal?.onUrlChanged) return;
    const unsubscribe = shell.portal.onUrlChanged((event) => {
      if (event.portalId !== portalSessionId) {
        return;
      }
      setUrlDraft(event.url);
      if (event.url !== url) {
        void canvasStore.updatePortalNode(node.id, { url: event.url });
      }
    });
    return unsubscribe;
  }, [node.id, portalSessionId, url]);

  useEffect(() => {
    const shell = (window as Window & { openweaveShell?: { portal: { onNewWindow: (cb: (e: { parentPortalId: string; url: string }) => void) => () => void } } }).openweaveShell;
    if (!shell?.portal?.onNewWindow) return;
    const unsubscribe = shell.portal.onNewWindow((event) => {
      if (event.parentPortalId !== portalSessionId) {
        return;
      }
      void canvasStore.addPortalNodeFromNewWindow(node.id, event.url);
    });
    return unsubscribe;
  }, [node.id, portalSessionId]);

  useEffect(() => {
    const el = articleRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
    };
    el.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => el.removeEventListener('wheel', handleWheel, { capture: true });
  }, []);

  const handleUrlKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.select();
        return;
      }
      if (e.key === 'Enter') {
        const nextUrl = urlDraft.trim();
        if (nextUrl) {
          void canvasStore.updatePortalNode(node.id, { url: nextUrl });
        }
      }
    },
    [urlDraft, node.id]
  );

  const handleRefresh = useCallback(() => {
    const nextUrl = urlDraft.trim();
    if (nextUrl) {
      void canvasStore.updatePortalNode(node.id, { url: nextUrl });
    }
  }, [urlDraft, node.id]);

  const handlePortalChange = useCallback(
    (patch: Parameters<typeof canvasStore.updatePortalNode>[1]) => {
      void canvasStore.updatePortalNode(node.id, patch);
    },
    [node.id]
  );

  return (
    <article
      ref={articleRef}
      className="ow-builtin-node-frame ow-portal-host"
      data-node-kind="portal"
      data-node-state={state}
      data-testid={`builtin-node-frame-${node.id}`}
    >
      <header className="ow-portal-host__header">
        <div className="ow-portal-host__traffic-lights">
          <span className="ow-portal-host__light ow-portal-host__light--close" />
          <span className="ow-portal-host__light ow-portal-host__light--minimize" />
          <span className="ow-portal-host__light ow-portal-host__light--maximize" />
        </div>
        <span className="ow-portal-host__title">{pageTitle || node.title}</span>
        <span className="ow-portal-host__spacer" />
      </header>
      <div className="ow-portal-host__controls">
        <button
          className="ow-portal-host__nav-btn"
          type="button"
          disabled
          data-testid={`portal-back-${node.id}`}
          title="Back"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <button
          className="ow-portal-host__nav-btn"
          type="button"
          disabled
          data-testid={`portal-forward-${node.id}`}
          title="Forward"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <button
          className="ow-portal-host__nav-btn"
          type="button"
          data-testid={`portal-refresh-${node.id}`}
          title="Refresh"
          onClick={handleRefresh}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
        <input
          className="ow-portal-host__url-input nodrag nopan"
          type="text"
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          onKeyDown={handleUrlKeyDown}
          placeholder="Enter URL..."
          data-testid={`portal-url-${node.id}`}
        />
      </div>
      <div className="ow-portal-host__body">
        <PortalNode
          workspaceId={workspaceId}
          node={{
            id: node.id,
            type: 'portal',
            x: node.bounds.x,
            y: node.bounds.y,
            url
          }}
          onChange={handlePortalChange}
        />
      </div>
    </article>
  );
};
