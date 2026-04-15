import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { WebContentsView } from 'electron';
import { assertPortalUrlAllowed } from '../../shared/portal/types';
import type { PortalScreenshotResult, PortalStructureResult } from '../../shared/portal/types';

interface ManagedPortalEntry {
  view: WebContentsView;
  loadedUrl: string | null;
}

const FALLBACK_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==',
  'base64'
);

const sanitizeSegment = (value: string): string => {
  const normalized = value.replace(/[^a-zA-Z0-9_-]/g, '-');
  return normalized.length > 0 ? normalized : 'portal';
};

export const toPortalPartitionId = (portalId: string): string => {
  const hash = createHash('sha256').update(portalId).digest('hex');
  return `openweave-portal-${hash}`;
};

const isAllowedPortalUrl = (value: string): boolean => {
  try {
    assertPortalUrlAllowed(value);
    return true;
  } catch {
    return false;
  }
};

const attachPortalNavigationGuards = (
  entry: ManagedPortalEntry,
  getLastLoadedUrl: () => string | null
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
    if (!details.isMainFrame || isAllowedPortalUrl(details.url)) {
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
    return { action: 'allow' };
  });
};

export interface PortalManager {
  loadUrl: (portalId: string, url: string) => Promise<void>;
  capture: (portalId: string, workspaceId: string, nodeId: string) => Promise<PortalScreenshotResult>;
  readStructure: (portalId: string) => Promise<PortalStructureResult>;
  click: (portalId: string, selector: string) => Promise<void>;
  input: (portalId: string, selector: string, value: string) => Promise<void>;
  disposePortal: (portalId: string) => void;
  dispose: () => void;
}

export interface PortalManagerOptions {
  artifactsRootDir: string;
  now?: () => number;
}

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

export const createPortalManager = (options: PortalManagerOptions): PortalManager => {
  const entries = new Map<string, ManagedPortalEntry>();
  const now = options.now ?? (() => Date.now());

  const resolveEntry = (portalId: string): ManagedPortalEntry => {
    const existing = entries.get(portalId);
    if (existing) {
      return existing;
    }

    const created: ManagedPortalEntry = {
      view: new WebContentsView({
        webPreferences: {
          sandbox: true,
          partition: toPortalPartitionId(portalId),
          contextIsolation: true,
          nodeIntegration: false
        }
      }),
      loadedUrl: null
    };
    created.view.webContents.setAudioMuted(true);
    attachPortalNavigationGuards(created, () => created.loadedUrl);
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
      if (!entry.view.webContents.isDestroyed()) {
        entry.view.webContents.close();
      }
    } catch {
      // Keep disposal best-effort.
    }
    entries.delete(portalId);
  };

  return {
    loadUrl: async (portalId: string, url: string): Promise<void> => {
      const entry = resolveEntry(portalId);
      try {
        await entry.view.webContents.loadURL(url);
        entry.loadedUrl = url;
      } catch (error) {
        // loadURL failed; remove transient runtime state for this portal ID.
        if (!entry.view.webContents.isDestroyed()) {
          entry.view.webContents.close();
        }
        entries.delete(portalId);
        throw error;
      }
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
        async () => {
          const image = await entry.view.webContents.capturePage();
          const buffer = image.toPNG();
          return buffer.length > 0 ? buffer : FALLBACK_PNG_BUFFER;
        },
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
    disposePortal: (portalId: string): void => {
      disposePortalEntry(portalId);
    },
    dispose: (): void => {
      for (const portalId of [...entries.keys()]) {
        disposePortalEntry(portalId);
      }
    }
  };
};
