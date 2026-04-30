import fs from 'node:fs';
import path from 'node:path';
import { BrowserWindow, WebContentsView } from 'electron';
import { assertPortalUrlAllowed } from '../../shared/portal/types';
import type { PortalScreenshotResult, PortalStructureResult } from '../../shared/portal/types';

interface ManagedPortalEntry {
  hostWindow: BrowserWindow;
  view: WebContentsView;
  loadedUrl: string | null;
  ownsHostWindow: boolean;
  bounds: PortalViewBounds;
  pendingLoad: {
    url: string;
    promise: Promise<void>;
  } | null;
}

export interface PortalViewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  scale: number;
}

const FALLBACK_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==',
  'base64'
);
const PORTAL_CAPTURE_WIDTH = 1280;
const PORTAL_CAPTURE_HEIGHT = 800;
const PORTAL_CAPTURE_SETTLE_MS = 250;
const PORTAL_ABORT_REDIRECT_SETTLE_MS = 50;
const PORTAL_ERROR_PAGE_MARKER = 'openweave-portal-error-page';

const sanitizeSegment = (value: string): string => {
  const normalized = value.replace(/[^a-zA-Z0-9_-]/g, '-');
  return normalized.length > 0 ? normalized : 'portal';
};

export const toPortalPartitionId = (_portalId: string): string => {
  return 'persist:openweave-portal';
};

const isAllowedPortalUrl = (value: string): boolean => {
  try {
    assertPortalUrlAllowed(value);
    return true;
  } catch {
    return false;
  }
};

const isInternalPortalErrorPageUrl = (value: string): boolean => {
  return value.startsWith('data:text/html') && value.includes(PORTAL_ERROR_PAGE_MARKER);
};

const isAbortedNavigationError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('ERR_ABORTED') || message.includes('(-3)');
};

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const createPortalErrorPageUrl = (targetUrl: string, error: unknown): string => {
  const message = error instanceof Error ? error.message : 'The page could not be loaded.';
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="${PORTAL_ERROR_PAGE_MARKER}" content="true" />
    <title>Portal page unavailable</title>
    <style>
      html, body {
        margin: 0;
        width: 100%;
        min-height: 100%;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f7f8fb;
        color: #1f2937;
      }
      body {
        display: grid;
        place-items: center;
        padding: 48px;
        box-sizing: border-box;
      }
      main {
        max-width: 720px;
        width: 100%;
        border: 1px solid #d7dce6;
        border-radius: 12px;
        background: #fff;
        padding: 28px;
        box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
      }
      h1 {
        margin: 0 0 10px;
        font-size: 22px;
      }
      p {
        margin: 0 0 14px;
        color: #5b6472;
        line-height: 1.5;
      }
      code {
        display: block;
        overflow-wrap: anywhere;
        border: 1px solid #e3e7ef;
        border-radius: 8px;
        background: #f3f5f9;
        padding: 10px 12px;
        color: #334155;
        font-size: 13px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Portal page unavailable</h1>
      <p>The requested page could not be loaded. Check the URL and try again.</p>
      <code>${escapeHtml(targetUrl)}</code>
      <p>${escapeHtml(message)}</p>
    </main>
  </body>
</html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
};

const attachPortalNavigationGuards = (
  entry: ManagedPortalEntry,
  getLastLoadedUrl: () => string | null,
  onNewWindow?: (url: string) => void
): void => {
  const webContents = entry.view.webContents;
  let blockedNavigationPendingRecovery = false;
  const recoverLastAllowedUrl = (): void => {
    const fallbackUrl = getLastLoadedUrl();
    if (!fallbackUrl || webContents.isDestroyed()) {
      return;
    }
    setTimeout(() => {
      if (webContents.isDestroyed()) {
        return;
      }
      void webContents.loadURL(fallbackUrl).catch(() => {
        // Keep recovery best-effort because blocking a bad navigation is the primary guarantee.
      });
    }, 0);
  };

  const blockDisallowedNavigation = (
    details: Pick<Electron.Event<Electron.WebContentsWillNavigateEventParams>, 'isMainFrame' | 'url' | 'preventDefault'>
  ): void => {
    if (!details.isMainFrame || isAllowedPortalUrl(details.url) || isInternalPortalErrorPageUrl(details.url)) {
      return;
    }
    blockedNavigationPendingRecovery = true;
    details.preventDefault();
    recoverLastAllowedUrl();
  };

  const recoverFromBlockedNavigationFailure = (
    _event: Electron.Event,
    _errorCode: number,
    _errorDescription: string,
    _validatedURL: string,
    isMainFrame: boolean
  ): void => {
    if (!isMainFrame || !blockedNavigationPendingRecovery) {
      return;
    }
    blockedNavigationPendingRecovery = false;
    recoverLastAllowedUrl();
  };

  webContents.on('will-navigate', (details) => {
    blockDisallowedNavigation(details);
  });
  webContents.on('will-redirect', (details) => {
    blockDisallowedNavigation(details);
  });
  webContents.on('did-fail-load', recoverFromBlockedNavigationFailure);
  webContents.on('did-fail-provisional-load', recoverFromBlockedNavigationFailure);
  webContents.on('did-finish-load', () => {
    blockedNavigationPendingRecovery = false;
  });
  webContents.setWindowOpenHandler((details) => {
    if (!isAllowedPortalUrl(details.url)) {
      return { action: 'deny' };
    }
    onNewWindow?.(details.url);
    return { action: 'deny' };
  });
};

export interface PortalManager {
  loadUrl: (portalId: string, url: string) => Promise<void>;
  capture: (portalId: string, workspaceId: string, nodeId: string) => Promise<PortalScreenshotResult>;
  readStructure: (portalId: string) => Promise<PortalStructureResult>;
  click: (portalId: string, selector: string) => Promise<void>;
  input: (portalId: string, selector: string, value: string) => Promise<void>;
  setBounds: (portalId: string, bounds: PortalViewBounds) => void;
  disposePortal: (portalId: string) => void;
  dispose: () => void;
  onTitleChanged: (callback: (portalId: string, title: string) => void) => void;
  onUrlChanged: (callback: (portalId: string, url: string) => void) => void;
  onNewWindow: (callback: (parentPortalId: string, url: string) => void) => void;
}

export interface PortalManagerOptions {
  artifactsRootDir: string;
  getHostWindow?: () => BrowserWindow | null;
  now?: () => number;
}

const wait = async (durationMs: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
};

const executeOnPortal = async <T,>(
  entry: ManagedPortalEntry,
  executor: () => Promise<T>,
  fallback: T
): Promise<T> => {
  if (!entry.loadedUrl) {
    return fallback;
  }
  try {
    return await executor();
  } catch {
    return fallback;
  }
};

const resolveAllowedCurrentUrl = async (
  entry: ManagedPortalEntry,
  requestedUrl: string
): Promise<string | null> => {
  const previousUrl = entry.loadedUrl;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (entry.view.webContents.isDestroyed()) {
      return null;
    }
    const currentUrl = entry.view.webContents.getURL();
    if (
      currentUrl &&
      isAllowedPortalUrl(currentUrl) &&
      (previousUrl === null || currentUrl === requestedUrl || currentUrl !== previousUrl)
    ) {
      return assertPortalUrlAllowed(currentUrl);
    }
    await wait(PORTAL_ABORT_REDIRECT_SETTLE_MS);
  }

  return null;
};

export const createPortalManager = (options: PortalManagerOptions): PortalManager => {
  const entries = new Map<string, ManagedPortalEntry>();
  const now = options.now ?? (() => Date.now());
  let titleChangedCallback: ((portalId: string, title: string) => void) | null = null;
  let urlChangedCallback: ((portalId: string, url: string) => void) | null = null;
  let newWindowCallback: ((parentPortalId: string, url: string) => void) | null = null;

  const resolveEntry = (portalId: string): ManagedPortalEntry => {
    const existing = entries.get(portalId);
    if (existing) {
      return existing;
    }

    const providedHostWindow = options.getHostWindow?.() ?? null;
    const ownsHostWindow = !providedHostWindow;
    const hostWindow = providedHostWindow ?? new BrowserWindow({
      width: PORTAL_CAPTURE_WIDTH,
      height: PORTAL_CAPTURE_HEIGHT,
      show: false,
      paintWhenInitiallyHidden: true,
      webPreferences: {
        sandbox: false
      }
    });
    const initialBounds = ownsHostWindow
      ? { x: 0, y: 0, width: PORTAL_CAPTURE_WIDTH, height: PORTAL_CAPTURE_HEIGHT, visible: true, scale: 1 }
      : { x: 0, y: 0, width: 0, height: 0, visible: false, scale: 1 };
    const created: ManagedPortalEntry = {
      hostWindow,
      view: new WebContentsView({
        webPreferences: {
          sandbox: true,
          partition: toPortalPartitionId(portalId),
          contextIsolation: true,
          nodeIntegration: false
        }
      }),
      loadedUrl: null,
      ownsHostWindow,
      bounds: initialBounds,
      pendingLoad: null
    };
    created.view.setBounds({
      x: initialBounds.x,
      y: initialBounds.y,
      width: initialBounds.visible ? initialBounds.width : 0,
      height: initialBounds.visible ? initialBounds.height : 0
    });
    created.hostWindow.contentView.addChildView(created.view);
    created.view.webContents.setAudioMuted(true);
    created.view.webContents.setZoomFactor(1);
    attachPortalNavigationGuards(created, () => created.loadedUrl, (url) => {
      newWindowCallback?.(portalId, url);
    });
    created.view.webContents.on('page-title-updated', (_event, title) => {
      titleChangedCallback?.(portalId, title);
    });
    const handleUrlChanged = (_event: Electron.Event, url: string): void => {
      if (!isAllowedPortalUrl(url)) {
        return;
      }
      const normalizedUrl = assertPortalUrlAllowed(url);
      created.loadedUrl = normalizedUrl;
      urlChangedCallback?.(portalId, normalizedUrl);
    };
    created.view.webContents.on('did-navigate', handleUrlChanged);
    created.view.webContents.on('did-navigate-in-page', handleUrlChanged);
    entries.set(portalId, created);
    return created;
  };

  const resolveLoadedEntry = (portalId: string): ManagedPortalEntry => {
    const entry = entries.get(portalId);
    if (!entry || !entry.loadedUrl) {
      throw new Error(`Portal is not loaded: ${portalId}`);
    }
    return entry;
  };

  const disposePortalEntry = (portalId: string): void => {
    const entry = entries.get(portalId);
    if (!entry) {
      return;
    }
    try {
      if (!entry.hostWindow.isDestroyed()) {
        entry.hostWindow.contentView.removeChildView(entry.view);
      }
    } catch {
      // Keep disposal best-effort.
    }
    try {
      if (!entry.view.webContents.isDestroyed()) {
        entry.view.webContents.close();
      }
    } catch {
      // Keep disposal best-effort.
    }
    try {
      if (entry.ownsHostWindow && !entry.hostWindow.isDestroyed()) {
        entry.hostWindow.destroy();
      }
    } catch {
      // Keep disposal best-effort.
    }
    entries.delete(portalId);
  };

  const captureFromAttachedHostWindow = async (entry: ManagedPortalEntry): Promise<Buffer> => {
    if (entry.bounds.width === 0 || entry.bounds.height === 0) {
      entry.view.setBounds({
        x: 0,
        y: 0,
        width: PORTAL_CAPTURE_WIDTH,
        height: PORTAL_CAPTURE_HEIGHT
      });
    }
    await wait(PORTAL_CAPTURE_SETTLE_MS);
    const image = await entry.view.webContents.capturePage();
    const buffer = image.toPNG();
    return buffer.length > 0 ? buffer : FALLBACK_PNG_BUFFER;
  };

  return {
    loadUrl: async (portalId: string, url: string): Promise<void> => {
      const entry = resolveEntry(portalId);
      if (entry.loadedUrl === url && !entry.pendingLoad) {
        return;
      }
      if (entry.pendingLoad?.url === url) {
        return entry.pendingLoad.promise;
      }

      let loadPromise!: Promise<void>;
      loadPromise = (async () => {
        try {
          await entry.view.webContents.loadURL(url);
          entry.loadedUrl = url;
        } catch (error) {
          if (entry.pendingLoad?.promise !== loadPromise) {
            throw error;
          }
          if (!isAbortedNavigationError(error)) {
            await entry.view.webContents.loadURL(createPortalErrorPageUrl(url, error));
            entry.loadedUrl = url;
            return;
          }
          const redirectedUrl = await resolveAllowedCurrentUrl(entry, url);
          if (redirectedUrl) {
            entry.loadedUrl = redirectedUrl;
            urlChangedCallback?.(portalId, redirectedUrl);
            return;
          }
          if (entry.loadedUrl && isAllowedPortalUrl(entry.loadedUrl)) {
            return;
          }
          // loadURL failed; remove transient runtime state for this portal ID.
          disposePortalEntry(portalId);
          throw error;
        } finally {
          if (entry.pendingLoad?.promise === loadPromise) {
            entry.pendingLoad = null;
          }
        }
      })();
      entry.pendingLoad = { url, promise: loadPromise };
      return loadPromise;
    },
    capture: async (
      portalId: string,
      workspaceId: string,
      nodeId: string
    ): Promise<PortalScreenshotResult> => {
      const entry = resolveLoadedEntry(portalId);
      const timestamp = now();
      const nodeDir = path.join(
        options.artifactsRootDir,
        sanitizeSegment(workspaceId),
        sanitizeSegment(nodeId)
      );
      fs.mkdirSync(nodeDir, { recursive: true });
      const screenshotPath = path.join(
        nodeDir,
        `${sanitizeSegment(portalId)}-${String(timestamp)}.png`
      );

      const pngBuffer = await executeOnPortal(
        entry,
        async () => captureFromAttachedHostWindow(entry),
        FALLBACK_PNG_BUFFER
      );

      fs.writeFileSync(screenshotPath, pngBuffer);
      return {
        path: screenshotPath,
        takenAtMs: timestamp
      };
    },
    readStructure: async (portalId: string): Promise<PortalStructureResult> => {
      const entry = resolveLoadedEntry(portalId);
      const fallback: PortalStructureResult = {
        elements: [{ tag: 'document', text: '' }]
      };
      return executeOnPortal(
        entry,
        async () => {
          const result = await entry.view.webContents.executeJavaScript(
            `(() => {
              const selected = Array.from(
                document.querySelectorAll('button,input,textarea,select,a,[role],[data-testid],h1,h2,h3,p,li')
              ).slice(0, 80);
              const mapped = selected.map((element) => ({
                tag: element.tagName.toLowerCase(),
                text: (element.textContent || '').trim().slice(0, 120),
                id: element.id || undefined,
                role: element.getAttribute('role') || undefined
              }));
              if (mapped.length === 0) {
                return [{ tag: 'document', text: document.title || '' }];
              }
              return mapped;
            })();`,
            true
          );

          if (!Array.isArray(result)) {
            return fallback;
          }
          return {
            elements: result
              .filter((element) => typeof element === 'object' && element !== null)
              .map((element) => {
                const typed = element as Record<string, unknown>;
                return {
                  tag: typeof typed.tag === 'string' ? typed.tag : 'unknown',
                  text: typeof typed.text === 'string' ? typed.text : '',
                  id: typeof typed.id === 'string' ? typed.id : undefined,
                  role: typeof typed.role === 'string' ? typed.role : undefined
                };
              })
          };
        },
        fallback
      );
    },
    click: async (portalId: string, selector: string): Promise<void> => {
      const entry = resolveLoadedEntry(portalId);
      const trimmedSelector = selector.trim();
      if (trimmedSelector.length === 0) {
        throw new Error('Selector is required');
      }
      await entry.view.webContents.executeJavaScript(
        `(() => {
          const element = document.querySelector(${JSON.stringify(trimmedSelector)});
          if (!element) {
            throw new Error('Element not found');
          }
          element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        })();`,
        true
      );
    },
    input: async (portalId: string, selector: string, value: string): Promise<void> => {
      const entry = resolveLoadedEntry(portalId);
      const trimmedSelector = selector.trim();
      if (trimmedSelector.length === 0) {
        throw new Error('Selector is required');
      }

      await entry.view.webContents.executeJavaScript(
        `(() => {
          const element = document.querySelector(${JSON.stringify(trimmedSelector)});
          if (!element) {
            throw new Error('Element not found');
          }

          if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            element.value = ${JSON.stringify(value)};
          } else if (element instanceof HTMLElement && element.isContentEditable) {
            element.textContent = ${JSON.stringify(value)};
          } else {
            throw new Error('Element is not editable');
          }

          element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
          element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        })();`,
        true
      );
    },
    setBounds: (portalId: string, bounds: PortalViewBounds): void => {
      const entry = resolveEntry(portalId);
      const roundedBounds = {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.max(0, Math.round(bounds.width)),
        height: Math.max(0, Math.round(bounds.height)),
        visible: bounds.visible,
        scale: Math.min(Math.max(bounds.scale, 0.1), 5)
      };
      entry.bounds = roundedBounds;
      entry.view.webContents.setZoomFactor(roundedBounds.scale);
      entry.view.setBounds({
        x: roundedBounds.x,
        y: roundedBounds.y,
        width: roundedBounds.visible ? roundedBounds.width : 0,
        height: roundedBounds.visible ? roundedBounds.height : 0
      });
    },
    disposePortal: (portalId: string): void => {
      disposePortalEntry(portalId);
    },
    dispose: (): void => {
      for (const portalId of [...entries.keys()]) {
        disposePortalEntry(portalId);
      }
    },
    onTitleChanged: (callback: (portalId: string, title: string) => void): void => {
      titleChangedCallback = callback;
    },
    onUrlChanged: (callback: (portalId: string, url: string) => void): void => {
      urlChangedCallback = callback;
    },
    onNewWindow: (callback: (parentPortalId: string, url: string) => void): void => {
      newWindowCallback = callback;
    }
  };
};
