import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  PortalBounds,
  PortalDefinition,
  PortalHarnessSnapshot,
  PortalVisualState,
} from '../shared/portal-contract';

declare global {
  interface Window {
    portalHarness: {
      bootstrap: () => Promise<PortalHarnessSnapshot>;
      activatePortal: (portalId: string) => Promise<PortalHarnessSnapshot>;
      setZoom: (zoom: number) => Promise<PortalHarnessSnapshot>;
      syncPortalBounds: (portalId: string, bounds: PortalBounds) => Promise<PortalHarnessSnapshot>;
      subscribe: (listener: (snapshot: PortalHarnessSnapshot) => void) => () => void;
    };
  }
}

const emptySnapshot: PortalHarnessSnapshot = {
  portals: [],
  activePortalId: 'portal-a',
  livePortalId: null,
  zoom: 1,
  portalStates: {},
};

function usePortalSnapshot() {
  const [snapshot, setSnapshot] = useState<PortalHarnessSnapshot>(emptySnapshot);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = window.portalHarness.subscribe((next) => {
      if (mounted) {
        setSnapshot(next);
      }
    });

    void window.portalHarness.bootstrap().then((next) => {
      if (mounted) {
        setSnapshot(next);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return [snapshot, setSnapshot] as const;
}

function fallbackStateFor(portal: PortalDefinition, state: PortalVisualState | undefined) {
  return state ?? { mode: 'fallback', bounds: null, fallbackDataUrl: null, syncId: 0 };
}

function PortalHarness() {
  const [snapshot] = usePortalSnapshot();
  const surfacesRef = useRef<Record<string, HTMLDivElement | null>>({});

  const syncBounds = useMemo(
    () => async () => {
      await Promise.all(
        snapshot.portals.map(async (portal) => {
          const element = surfacesRef.current[portal.id];
          if (!element) {
            return;
          }

          const rect = element.getBoundingClientRect();
          await window.portalHarness.syncPortalBounds(portal.id, {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          });
        }),
      );
    },
    [snapshot.portals],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void syncBounds();
    }, 40);

    const handleResize = () => {
      void syncBounds();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [syncBounds, snapshot.activePortalId, snapshot.zoom]);

  return (
    <main className="portal-shell">
      <header className="portal-header">
        <div>
          <p className="eyebrow">OpenWeave</p>
          <h1>Portal Shell PoC</h1>
        </div>
        <div className="active-chip">
          <div>
            Active portal: <span data-testid="active-portal-id">{snapshot.activePortalId}</span>
          </div>
          <div>
            Live portal: <span data-testid="live-portal-id">{snapshot.livePortalId ?? 'none'}</span>
          </div>
        </div>
      </header>

      <section className="controls">
        {snapshot.portals.map((portal) => (
          <button
            key={portal.id}
            type="button"
            className={portal.id === snapshot.activePortalId ? 'control-button is-active' : 'control-button'}
            onClick={() => {
              void window.portalHarness.activatePortal(portal.id).then(() => syncBounds());
            }}
          >
            Activate {portal.id}
          </button>
        ))}

        <label className="zoom-control">
          <span>Canvas zoom</span>
          <input
            aria-label="Canvas zoom"
            type="range"
            min="0.2"
            max="1"
            step="0.05"
            value={snapshot.zoom}
            onInput={(event) => {
              void window.portalHarness.setZoom(Number((event.currentTarget as HTMLInputElement).value)).then(() => syncBounds());
            }}
          />
          <strong>{snapshot.zoom.toFixed(2)}x</strong>
        </label>
      </section>

      <section className="portal-grid">
        {snapshot.portals.map((portal) => {
          const state = fallbackStateFor(portal, snapshot.portalStates[portal.id]);

          return (
            <article key={portal.id} data-testid={portal.id} className="portal-card">
              <div className="portal-card__top">
                <strong>{portal.label}</strong>
                <span>{portal.url}</span>
              </div>
              <div
                ref={(node) => {
                  surfacesRef.current[portal.id] = node;
                }}
                className="portal-card__surface"
              >
                {state.mode === 'fallback' ? (
                  <div data-testid={`${portal.id}-fallback`} className="portal-card__fallback">
                    {state.fallbackDataUrl ? <img alt={`${portal.label} fallback`} src={state.fallbackDataUrl} /> : null}
                    <div className="portal-card__fallback-label">Fallback snapshot</div>
                  </div>
                ) : (
                  <div className="portal-card__live-label">Electron live view attached</div>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('Missing root container');
}

createRoot(container).render(
  <React.StrictMode>
    <PortalHarness />
  </React.StrictMode>,
);
