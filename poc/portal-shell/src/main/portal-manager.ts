import { BrowserWindow, WebContentsView } from 'electron';
import type {
  PortalBounds,
  PortalDefinition,
  PortalHarnessSnapshot,
  PortalVisualState,
} from '../shared/portal-contract';

type PortalEntry = {
  portal: PortalDefinition;
  view: WebContentsView;
  bounds: PortalBounds | null;
  fallbackDataUrl: string | null;
  syncId: number;
  loadPromise: Promise<void>;
  captureInFlight: Promise<void> | null;
};

const MIN_LIVE_ZOOM = 0.45;

export class PortalManager {
  private readonly entries = new Map<string, PortalEntry>();
  private readonly window: BrowserWindow;
  private readonly onSnapshot: (snapshot: PortalHarnessSnapshot) => void;
  private activePortalId: string;
  private livePortalId: string | null = null;
  private zoom = 1;

  constructor(window: BrowserWindow, portals: PortalDefinition[], onSnapshot: (snapshot: PortalHarnessSnapshot) => void) {
    this.window = window;
    this.onSnapshot = onSnapshot;
    this.activePortalId = portals[0]?.id ?? 'portal-a';

    for (const portal of portals) {
      const view = new WebContentsView({
        webPreferences: {
          sandbox: true,
        },
      });
      view.webContents.setAudioMuted(true);
      const loadPromise = view.webContents.loadURL(portal.url).then(() => undefined);
      this.entries.set(portal.id, {
        portal,
        view,
        bounds: null,
        fallbackDataUrl: this.makeFallbackDataUrl(portal, 'warming up'),
        syncId: 0,
        loadPromise,
        captureInFlight: null,
      });
    }
  }

  async bootstrap(): Promise<PortalHarnessSnapshot> {
    await this.reconcilePresentation();
    return this.getSnapshot();
  }

  async setActivePortal(portalId: string): Promise<PortalHarnessSnapshot> {
    if (!this.entries.has(portalId)) {
      throw new Error(`Unknown portal: ${portalId}`);
    }

    this.activePortalId = portalId;
    await this.reconcilePresentation();
    return this.getSnapshot();
  }

  async setZoom(zoom: number): Promise<PortalHarnessSnapshot> {
    this.zoom = zoom;
    await this.reconcilePresentation();
    return this.getSnapshot();
  }

  async syncPortalBounds(portalId: string, bounds: PortalBounds): Promise<PortalHarnessSnapshot> {
    const entry = this.entries.get(portalId);
    if (!entry) {
      throw new Error(`Unknown portal: ${portalId}`);
    }

    entry.bounds = bounds;
    entry.syncId += 1;
    await this.reconcilePresentation();
    return this.getSnapshot();
  }

  private getSnapshot(): PortalHarnessSnapshot {
    const portalStates: Record<string, PortalVisualState> = {};

    for (const [id, entry] of this.entries) {
      portalStates[id] = {
        mode: this.livePortalId === id ? 'live' : 'fallback',
        bounds: entry.bounds,
        fallbackDataUrl: this.livePortalId === id ? null : entry.fallbackDataUrl,
        syncId: entry.syncId,
      };
    }

    return {
      portals: Array.from(this.entries.values()).map((entry) => entry.portal),
      activePortalId: this.activePortalId,
      livePortalId: this.livePortalId,
      zoom: this.zoom,
      portalStates,
    };
  }

  private async reconcilePresentation(): Promise<void> {
    const activeEntry = this.entries.get(this.activePortalId);
    const bounds = activeEntry?.bounds ?? null;
    const shouldShowLive = Boolean(
      activeEntry &&
        bounds &&
        bounds.width > 24 &&
        bounds.height > 24 &&
        this.zoom >= MIN_LIVE_ZOOM,
    );

    if (shouldShowLive && activeEntry && bounds) {
      this.attachLiveEntry(activeEntry, bounds);
    } else {
      this.detachLiveEntry();
    }

    for (const entry of this.entries.values()) {
      if (this.livePortalId !== entry.portal.id) {
        void this.refreshFallback(entry);
      }
    }

    this.emit();
  }

  private attachLiveEntry(entry: PortalEntry, bounds: PortalBounds) {
    if (this.livePortalId && this.livePortalId !== entry.portal.id) {
      const previous = this.entries.get(this.livePortalId);
      if (previous) {
        this.window.contentView.removeChildView(previous.view);
      }
    }

    if (this.livePortalId !== entry.portal.id) {
      this.window.contentView.addChildView(entry.view);
    }

    entry.view.setBounds({
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
    });
    this.livePortalId = entry.portal.id;
  }

  private detachLiveEntry() {
    if (!this.livePortalId) {
      return;
    }

    const current = this.entries.get(this.livePortalId);
    if (current) {
      this.window.contentView.removeChildView(current.view);
    }
    this.livePortalId = null;
  }

  private async refreshFallback(entry: PortalEntry): Promise<void> {
    if (entry.captureInFlight) {
      return entry.captureInFlight;
    }

    entry.captureInFlight = (async () => {
      try {
        await entry.loadPromise;
        const image = await entry.view.webContents.capturePage();
        const captured = image.toDataURL();
        if (captured) {
          entry.fallbackDataUrl = captured;
        }
      } catch {
        entry.fallbackDataUrl = this.makeFallbackDataUrl(entry.portal, 'capture unavailable');
      } finally {
        entry.captureInFlight = null;
        this.emit();
      }
    })();

    return entry.captureInFlight;
  }

  private makeFallbackDataUrl(portal: PortalDefinition, status: string): string {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520">
        <defs>
          <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="#163a4a" />
            <stop offset="100%" stop-color="#cb7e3b" />
          </linearGradient>
        </defs>
        <rect width="800" height="520" rx="28" fill="url(#bg)" />
        <rect x="42" y="42" width="716" height="436" rx="22" fill="rgba(255,255,255,0.14)" />
        <text x="72" y="120" fill="#fff7ef" font-size="38" font-family="Helvetica, Arial, sans-serif">${portal.label}</text>
        <text x="72" y="176" fill="#fde7d2" font-size="24" font-family="Helvetica, Arial, sans-serif">${portal.url}</text>
        <text x="72" y="430" fill="#fff7ef" font-size="22" font-family="Helvetica, Arial, sans-serif">Fallback snapshot: ${status}</text>
      </svg>`;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  private emit() {
    this.onSnapshot(this.getSnapshot());
  }
}
