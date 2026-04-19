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
    const close = vi.fn();
    const removeChildView = vi.fn();
    const addChildView = vi.fn();
    const destroy = vi.fn();
    const browserWindowOptions: Array<Record<string, unknown>> = [];

    vi.doMock('electron', () => {
      class MockWebContentsView {
        public readonly webContents = {
          setAudioMuted: vi.fn(),
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
});
