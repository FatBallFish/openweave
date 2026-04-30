import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const createdPaths: string[] = [];

const mkdtemp = (prefix: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  createdPaths.push(dir);
  return dir;
};

afterEach(() => {
  while (createdPaths.length > 0) {
    fs.rmSync(createdPaths.pop()!, { recursive: true, force: true });
  }
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('portal manager behavior', () => {
  it('loads urls into a hidden host window, supports portal actions, and cleans up owned resources', async () => {
    const executeJavaScript = vi.fn(async () => [
      { tag: 'button', text: 'Run action', id: 'action-button', role: 'button' }
    ]);
    const capturePage = vi.fn(async () => ({
      toPNG: () => Buffer.alloc(12_345, 1)
    }));
    const loadURL = vi.fn(async () => undefined);
    const setZoomFactor = vi.fn();
    const close = vi.fn();
    const removeChildView = vi.fn();
    const addChildView = vi.fn();
    const destroy = vi.fn();
    const browserWindowOptions: Array<Record<string, unknown>> = [];

    vi.doMock('electron', () => {
      class MockWebContentsView {
        public readonly webContents = {
          setAudioMuted: vi.fn(),
          setZoomFactor,
          loadURL,
          capturePage,
          executeJavaScript,
          close,
          isDestroyed: vi.fn(() => false),
          on: vi.fn(),
          setWindowOpenHandler: vi.fn()
        };

        public setBounds = vi.fn();
      }

      class MockBrowserWindow {
        public constructor(options: Record<string, unknown>) {
          browserWindowOptions.push(options);
        }

        public readonly contentView = {
          addChildView,
          removeChildView
        };

        public readonly isDestroyed = vi.fn(() => false);
        public readonly destroy = destroy;
      }

      return {
        WebContentsView: MockWebContentsView,
        BrowserWindow: MockBrowserWindow
      };
    });

    const { createPortalManager } = await import('../../../src/main/portal/portal-manager');
    const artifactsRootDir = mkdtemp('openweave-portal-manager-');
    const manager = createPortalManager({
      artifactsRootDir,
      now: () => 123
    });

    await manager.loadUrl('ws-1:portal-1', 'https://example.com/demo');
    expect(browserWindowOptions).toEqual([
      expect.objectContaining({
        show: false,
        paintWhenInitiallyHidden: true
      })
    ]);
    expect(addChildView).toHaveBeenCalledTimes(1);

    const screenshot = await manager.capture('ws-1:portal-1', 'ws-1', 'portal-1');
    const structure = await manager.readStructure('ws-1:portal-1');
    await manager.click('ws-1:portal-1', '#action-button');
    await manager.input('ws-1:portal-1', '#message-input', 'hello');
    manager.disposePortal('ws-1:portal-1');
    manager.dispose();

    expect(loadURL).toHaveBeenCalledWith('https://example.com/demo');
    expect(setZoomFactor).toHaveBeenCalledWith(1);
    expect(capturePage).toHaveBeenCalled();
    expect(fs.existsSync(screenshot.path)).toBe(true);
    expect(fs.statSync(screenshot.path).size).toBeGreaterThan(10_000);
    expect(structure.elements[0]).toMatchObject({ tag: 'button', text: 'Run action' });
    expect(executeJavaScript).toHaveBeenCalled();
    expect(removeChildView).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(destroy).toHaveBeenCalled();
  });

  it('rejects capture before a portal is loaded', async () => {
    vi.doMock('electron', () => {
      class MockWebContentsView {
        public readonly webContents = {
          setAudioMuted: vi.fn(),
          setZoomFactor: vi.fn(),
          loadURL: vi.fn(),
          capturePage: vi.fn(),
          executeJavaScript: vi.fn(),
          close: vi.fn(),
          isDestroyed: vi.fn(() => false),
          on: vi.fn(),
          setWindowOpenHandler: vi.fn()
        };

        public setBounds = vi.fn();
      }

      class MockBrowserWindow {
        public readonly contentView = {
          addChildView: vi.fn(),
          removeChildView: vi.fn()
        };

        public destroy = vi.fn();
      }

      return {
        WebContentsView: MockWebContentsView,
        BrowserWindow: MockBrowserWindow
      };
    });

    const { createPortalManager } = await import('../../../src/main/portal/portal-manager');
    const manager = createPortalManager({
      artifactsRootDir: mkdtemp('openweave-portal-manager-')
    });

    await expect(manager.capture('ws-1:portal-1', 'ws-1', 'portal-1')).rejects.toThrow(
      'Portal is not loaded: ws-1:portal-1'
    );
  });

  it('coalesces concurrent loads for the same portal URL', async () => {
    let resolveLoad: (() => void) | null = null;
    const loadURL = vi.fn(
      async () =>
        new Promise<void>((resolve) => {
          resolveLoad = resolve;
        })
    );

    vi.doMock('electron', () => {
      class MockWebContentsView {
        public readonly webContents = {
          setAudioMuted: vi.fn(),
          setZoomFactor: vi.fn(),
          loadURL,
          capturePage: vi.fn(),
          executeJavaScript: vi.fn(),
          close: vi.fn(),
          isDestroyed: vi.fn(() => false),
          on: vi.fn(),
          setWindowOpenHandler: vi.fn()
        };

        public setBounds = vi.fn();
      }

      class MockBrowserWindow {
        public readonly contentView = {
          addChildView: vi.fn(),
          removeChildView: vi.fn()
        };

        public readonly isDestroyed = vi.fn(() => false);
        public readonly destroy = vi.fn();
      }

      return {
        WebContentsView: MockWebContentsView,
        BrowserWindow: MockBrowserWindow
      };
    });

    const { createPortalManager } = await import('../../../src/main/portal/portal-manager');
    const manager = createPortalManager({
      artifactsRootDir: mkdtemp('openweave-portal-manager-')
    });

    const firstLoad = manager.loadUrl('ws-1:portal-1', 'https://www.baidu.com/');
    const secondLoad = manager.loadUrl('ws-1:portal-1', 'https://www.baidu.com/');

    expect(loadURL).toHaveBeenCalledTimes(1);
    resolveLoad?.();
    await Promise.all([firstLoad, secondLoad]);
  });

  it('loads a default portal error page when remote navigation fails', async () => {
    const loadURL = vi.fn(async (url: string) => {
      if (url === 'https://www.bi%27li.com/') {
        throw new Error("ERR_NAME_NOT_RESOLVED (-105) loading 'https://www.bi%27li.com/'");
      }
    });
    const executeJavaScript = vi.fn(async () => []);
    const capturePage = vi.fn(async () => ({
      toPNG: () => Buffer.alloc(16, 1)
    }));

    vi.doMock('electron', () => {
      class MockWebContentsView {
        public readonly webContents = {
          setAudioMuted: vi.fn(),
          setZoomFactor: vi.fn(),
          loadURL,
          capturePage,
          executeJavaScript,
          close: vi.fn(),
          isDestroyed: vi.fn(() => false),
          on: vi.fn(),
          setWindowOpenHandler: vi.fn()
        };

        public setBounds = vi.fn();
      }

      class MockBrowserWindow {
        public readonly contentView = {
          addChildView: vi.fn(),
          removeChildView: vi.fn()
        };

        public readonly isDestroyed = vi.fn(() => false);
        public readonly destroy = vi.fn();
      }

      return {
        WebContentsView: MockWebContentsView,
        BrowserWindow: MockBrowserWindow
      };
    });

    const { createPortalManager } = await import('../../../src/main/portal/portal-manager');
    const manager = createPortalManager({
      artifactsRootDir: mkdtemp('openweave-portal-manager-')
    });

    await expect(manager.loadUrl('ws-1:portal-1', 'https://www.bi%27li.com/')).resolves.toBeUndefined();
    await expect(manager.capture('ws-1:portal-1', 'ws-1', 'portal-1')).resolves.toMatchObject({
      takenAtMs: expect.any(Number)
    });

    expect(loadURL).toHaveBeenCalledTimes(2);
    expect(loadURL).toHaveBeenLastCalledWith(expect.stringContaining('data:text/html'));
    expect(decodeURIComponent(loadURL.mock.calls[1]?.[0] ?? '')).toContain('Portal page unavailable');
    expect(decodeURIComponent(loadURL.mock.calls[1]?.[0] ?? '')).toContain('ERR_NAME_NOT_RESOLVED');
  });

  it('treats ERR_ABORTED from a successful redirect as a completed load', async () => {
    const loadURL = vi.fn(async () => {
      throw new Error("ERR_ABORTED (-3) loading 'https://www.baidu.com/'");
    });
    const getURL = vi.fn(() => 'https://www.baidu.com/');
    const close = vi.fn();
    const destroy = vi.fn();
    const capturePage = vi.fn(async () => ({
      toPNG: () => Buffer.alloc(16, 1)
    }));

    vi.doMock('electron', () => {
      class MockWebContentsView {
        public readonly webContents = {
          setAudioMuted: vi.fn(),
          setZoomFactor: vi.fn(),
          loadURL,
          getURL,
          capturePage,
          executeJavaScript: vi.fn(),
          close,
          isDestroyed: vi.fn(() => false),
          on: vi.fn(),
          setWindowOpenHandler: vi.fn()
        };

        public setBounds = vi.fn();
      }

      class MockBrowserWindow {
        public readonly contentView = {
          addChildView: vi.fn(),
          removeChildView: vi.fn()
        };

        public readonly isDestroyed = vi.fn(() => false);
        public readonly destroy = destroy;
      }

      return {
        WebContentsView: MockWebContentsView,
        BrowserWindow: MockBrowserWindow
      };
    });

    const { createPortalManager } = await import('../../../src/main/portal/portal-manager');
    const manager = createPortalManager({
      artifactsRootDir: mkdtemp('openweave-portal-manager-')
    });
    const onUrlChanged = vi.fn();
    manager.onUrlChanged(onUrlChanged);

    await expect(manager.loadUrl('ws-1:portal-1', 'https://baidu.com/')).resolves.toBeUndefined();
    await expect(manager.capture('ws-1:portal-1', 'ws-1', 'portal-1')).resolves.toMatchObject({
      takenAtMs: expect.any(Number)
    });

    expect(close).not.toHaveBeenCalled();
    expect(destroy).not.toHaveBeenCalled();
    expect(onUrlChanged).toHaveBeenCalledWith('ws-1:portal-1', 'https://www.baidu.com/');
  });

  it('treats ERR_ABORTED as benign when the portal keeps a previously loaded allowed URL', async () => {
    const loadURL = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("ERR_ABORTED (-3) loading 'https://example.com/video-next'"));
    const getURL = vi.fn(() => '');
    const close = vi.fn();
    const destroy = vi.fn();
    const capturePage = vi.fn(async () => ({
      toPNG: () => Buffer.alloc(16, 1)
    }));

    vi.doMock('electron', () => {
      class MockWebContentsView {
        public readonly webContents = {
          setAudioMuted: vi.fn(),
          setZoomFactor: vi.fn(),
          loadURL,
          getURL,
          capturePage,
          executeJavaScript: vi.fn(),
          close,
          isDestroyed: vi.fn(() => false),
          on: vi.fn(),
          setWindowOpenHandler: vi.fn()
        };

        public setBounds = vi.fn();
      }

      class MockBrowserWindow {
        public readonly contentView = {
          addChildView: vi.fn(),
          removeChildView: vi.fn()
        };

        public readonly isDestroyed = vi.fn(() => false);
        public readonly destroy = destroy;
      }

      return {
        WebContentsView: MockWebContentsView,
        BrowserWindow: MockBrowserWindow
      };
    });

    const { createPortalManager } = await import('../../../src/main/portal/portal-manager');
    const manager = createPortalManager({
      artifactsRootDir: mkdtemp('openweave-portal-manager-')
    });

    await manager.loadUrl('ws-1:portal-1', 'https://example.com/video');
    await expect(manager.loadUrl('ws-1:portal-1', 'https://example.com/video-next')).resolves.toBeUndefined();

    expect(close).not.toHaveBeenCalled();
    expect(destroy).not.toHaveBeenCalled();
    await expect(manager.capture('ws-1:portal-1', 'ws-1', 'portal-1')).resolves.toMatchObject({
      takenAtMs: expect.any(Number)
    });
  });

  it('emits URL changes when the embedded page navigates itself', async () => {
    const webContentsHandlers = new Map<string, (...args: unknown[]) => void>();
    const loadURL = vi.fn(async () => undefined);

    vi.doMock('electron', () => {
      class MockWebContentsView {
        public readonly webContents = {
          setAudioMuted: vi.fn(),
          setZoomFactor: vi.fn(),
          loadURL,
          capturePage: vi.fn(),
          executeJavaScript: vi.fn(),
          close: vi.fn(),
          isDestroyed: vi.fn(() => false),
          on: vi.fn((eventName: string, handler: (...args: unknown[]) => void) => {
            webContentsHandlers.set(eventName, handler);
          }),
          setWindowOpenHandler: vi.fn()
        };

        public setBounds = vi.fn();
      }

      class MockBrowserWindow {
        public readonly contentView = {
          addChildView: vi.fn(),
          removeChildView: vi.fn()
        };

        public readonly isDestroyed = vi.fn(() => false);
        public readonly destroy = vi.fn();
      }

      return {
        WebContentsView: MockWebContentsView,
        BrowserWindow: MockBrowserWindow
      };
    });

    const { createPortalManager } = await import('../../../src/main/portal/portal-manager');
    const manager = createPortalManager({
      artifactsRootDir: mkdtemp('openweave-portal-manager-')
    });
    const onUrlChanged = vi.fn();
    manager.onUrlChanged(onUrlChanged);

    await manager.loadUrl('ws-1:portal-1', 'https://example.com/');
    webContentsHandlers.get('did-navigate')?.({}, 'https://example.com/docs');
    webContentsHandlers.get('did-navigate-in-page')?.({}, 'https://example.com/docs#section');

    expect(onUrlChanged).toHaveBeenCalledWith('ws-1:portal-1', 'https://example.com/docs');
    expect(onUrlChanged).toHaveBeenCalledWith('ws-1:portal-1', 'https://example.com/docs#section');
  });

  it('applies portal canvas scale to the embedded web contents zoom factor', async () => {
    const setBounds = vi.fn();
    const setZoomFactor = vi.fn();

    vi.doMock('electron', () => {
      class MockWebContentsView {
        public readonly webContents = {
          setAudioMuted: vi.fn(),
          setZoomFactor,
          loadURL: vi.fn(),
          capturePage: vi.fn(),
          executeJavaScript: vi.fn(),
          close: vi.fn(),
          isDestroyed: vi.fn(() => false),
          on: vi.fn(),
          setWindowOpenHandler: vi.fn()
        };

        public setBounds = setBounds;
      }

      class MockBrowserWindow {
        public readonly contentView = {
          addChildView: vi.fn(),
          removeChildView: vi.fn()
        };

        public readonly isDestroyed = vi.fn(() => false);
        public readonly destroy = vi.fn();
      }

      return {
        WebContentsView: MockWebContentsView,
        BrowserWindow: MockBrowserWindow
      };
    });

    const { createPortalManager } = await import('../../../src/main/portal/portal-manager');
    const manager = createPortalManager({
      artifactsRootDir: mkdtemp('openweave-portal-manager-')
    });

    manager.setBounds('ws-1:portal-1', {
      x: 40,
      y: 60,
      width: 210,
      height: 160,
      visible: true,
      scale: 0.5
    });

    expect(setBounds).toHaveBeenLastCalledWith({
      x: 40,
      y: 60,
      width: 210,
      height: 160
    });
    expect(setZoomFactor).toHaveBeenLastCalledWith(0.5);
  });
});
