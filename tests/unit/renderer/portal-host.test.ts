// @vitest-environment jsdom
import { StrictMode, act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PortalHost } from '../../../src/renderer/features/components/hosts/PortalHost';
import type { GraphSnapshotV2Input } from '../../../src/shared/ipc/schemas';

const mocked = vi.hoisted(() => ({
  updatePortalNode: vi.fn().mockResolvedValue(undefined),
  addPortalNodeFromNewWindow: vi.fn().mockResolvedValue(undefined),
  connectModeActive: false
}));

vi.mock('../../../src/renderer/features/canvas/canvas.store', () => ({
  canvasStore: {
    updatePortalNode: mocked.updatePortalNode,
    addPortalNodeFromNewWindow: mocked.addPortalNodeFromNewWindow
  },
  useCanvasStore: vi.fn((selector: (state: { connectModeActive: boolean }) => unknown) =>
    selector({ connectModeActive: mocked.connectModeActive })
  )
}));

const createPortalNode = (): GraphSnapshotV2Input['nodes'][number] => ({
  id: 'portal-1',
  componentType: 'builtin.portal',
  componentVersion: '1.0.0',
  title: 'Portal',
  bounds: {
    x: 20,
    y: 24,
    width: 420,
    height: 320
  },
  config: {
    url: 'https://www.baidu.com/'
  },
  state: {},
  capabilities: ['navigate', 'capture', 'input'],
  createdAtMs: 7,
  updatedAtMs: 8
});

describe('PortalHost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.connectModeActive = false;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('does not reload the current portal URL when a page title update rerenders the host', async () => {
    const loadPortal = vi.fn().mockResolvedValue({
      portal: {
        id: 'ws-1:portal-1',
        workspaceId: 'ws-1',
        nodeId: 'portal-1',
        url: 'https://www.baidu.com/',
        createdAtMs: 1,
        updatedAtMs: 1
      }
    });
    let pageTitleHandler: ((event: { portalId: string; title: string }) => void) | null = null;
    let urlChangedHandler: ((event: { portalId: string; url: string }) => void) | null = null;
    window.openweaveShell = {
      portal: {
        loadPortal,
        capturePortalScreenshot: vi.fn(),
        readPortalStructure: vi.fn(),
        clickPortalElement: vi.fn(),
        inputPortalText: vi.fn(),
        setPortalBounds: vi.fn(),
        onPageTitleChanged: vi.fn((handler: (event: { portalId: string; title: string }) => void) => {
          pageTitleHandler = handler;
          return () => {
            pageTitleHandler = null;
          };
        }),
        onUrlChanged: vi.fn((handler: (event: { portalId: string; url: string }) => void) => {
          urlChangedHandler = handler;
          return () => {
            urlChangedHandler = null;
          };
        }),
        onNewWindow: vi.fn(() => vi.fn())
      }
    } as unknown as typeof window.openweaveShell;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(PortalHost, {
          workspaceId: 'ws-1',
          workspaceRootDir: '/tmp/ws-1',
          node: createPortalNode(),
          onOpenRun: vi.fn(),
          onCreateBranchWorkspace: vi.fn()
        })
      );
      await Promise.resolve();
    });

    expect(loadPortal).toHaveBeenCalledTimes(1);

    await act(async () => {
      pageTitleHandler?.({ portalId: 'ws-1:portal-1', title: '百度一下' });
      await Promise.resolve();
    });

    expect(loadPortal).toHaveBeenCalledTimes(1);

    await act(async () => {
      urlChangedHandler?.({ portalId: 'ws-1:portal-1', url: 'https://www.baidu.com/search?q=openweave' });
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="portal-url-portal-1"]')).toHaveProperty(
      'value',
      'https://www.baidu.com/search?q=openweave'
    );
    expect(mocked.updatePortalNode).toHaveBeenCalledWith('portal-1', {
      url: 'https://www.baidu.com/search?q=openweave'
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('does not surface stale load failures after StrictMode remounts the portal node', async () => {
    const loadPortal = vi.fn()
      .mockRejectedValueOnce(new Error('ERR_ABORTED stale load'))
      .mockResolvedValueOnce({
        portal: {
          id: 'ws-1:portal-1',
          workspaceId: 'ws-1',
          nodeId: 'portal-1',
          url: 'https://www.baidu.com/',
          createdAtMs: 1,
          updatedAtMs: 1
        }
      });
    window.openweaveShell = {
      portal: {
        loadPortal,
        capturePortalScreenshot: vi.fn(),
        readPortalStructure: vi.fn(),
        clickPortalElement: vi.fn(),
        inputPortalText: vi.fn(),
        setPortalBounds: vi.fn(),
        onPageTitleChanged: vi.fn(() => vi.fn()),
        onUrlChanged: vi.fn(() => vi.fn()),
        onNewWindow: vi.fn(() => vi.fn())
      }
    } as unknown as typeof window.openweaveShell;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(
          StrictMode,
          null,
          createElement(PortalHost, {
            workspaceId: 'ws-1',
            workspaceRootDir: '/tmp/ws-1',
            node: createPortalNode(),
            onOpenRun: vi.fn(),
            onCreateBranchWorkspace: vi.fn()
          })
        )
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(loadPortal).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="portal-error-portal-1"]')).toBeNull();

    await act(async () => {
    root.unmount();
    });
    container.remove();
  });

  it('selects the entire portal URL with the standard select-all shortcut', async () => {
    const loadPortal = vi.fn().mockResolvedValue({
      portal: {
        id: 'ws-1:portal-1',
        workspaceId: 'ws-1',
        nodeId: 'portal-1',
        url: 'https://www.baidu.com/',
        createdAtMs: 1,
        updatedAtMs: 1
      }
    });
    window.openweaveShell = {
      portal: {
        loadPortal,
        capturePortalScreenshot: vi.fn(),
        readPortalStructure: vi.fn(),
        clickPortalElement: vi.fn(),
        inputPortalText: vi.fn(),
        setPortalBounds: vi.fn(),
        onPageTitleChanged: vi.fn(() => vi.fn()),
        onUrlChanged: vi.fn(() => vi.fn()),
        onNewWindow: vi.fn(() => vi.fn())
      }
    } as unknown as typeof window.openweaveShell;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(PortalHost, {
          workspaceId: 'ws-1',
          workspaceRootDir: '/tmp/ws-1',
          node: createPortalNode(),
          onOpenRun: vi.fn(),
          onCreateBranchWorkspace: vi.fn()
        })
      );
      await Promise.resolve();
    });

    const urlInput = container.querySelector<HTMLInputElement>('[data-testid="portal-url-portal-1"]');
    expect(urlInput).not.toBeNull();
    urlInput!.focus();
    urlInput!.setSelectionRange(urlInput!.value.length, urlInput!.value.length);

    await act(async () => {
      urlInput!.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'a',
        metaKey: true,
        bubbles: true,
        cancelable: true
      }));
    });

    expect(urlInput!.selectionStart).toBe(0);
    expect(urlInput!.selectionEnd).toBe(urlInput!.value.length);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('syncs the live portal surface bounds instead of rendering a screenshot preview', async () => {
    const loadPortal = vi.fn().mockResolvedValue({
      portal: {
        id: 'ws-1:portal-1',
        workspaceId: 'ws-1',
        nodeId: 'portal-1',
        url: 'https://www.baidu.com/',
        createdAtMs: 1,
        updatedAtMs: 1
      }
    });
    const capturePortalScreenshot = vi.fn();
    const setPortalBounds = vi.fn().mockResolvedValue(undefined);
    window.openweaveShell = {
      portal: {
        loadPortal,
        capturePortalScreenshot,
        readPortalStructure: vi.fn(),
        clickPortalElement: vi.fn(),
        inputPortalText: vi.fn(),
        setPortalBounds,
        onPageTitleChanged: vi.fn(() => vi.fn()),
        onUrlChanged: vi.fn(() => vi.fn()),
        onNewWindow: vi.fn(() => vi.fn())
      }
    } as unknown as typeof window.openweaveShell;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      if ((this as HTMLElement).dataset.testid === 'portal-node-portal-1') {
        return {
        x: 40,
        y: 60,
        left: 40,
        top: 60,
        width: 210,
        height: 160,
        right: 250,
        bottom: 220,
        toJSON: () => {}
        } as DOMRect;
      }
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        right: 0,
        bottom: 0,
        toJSON: () => {}
      } as DOMRect;
    });
    const offsetWidthSpy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function () {
      return (this as HTMLElement).dataset.testid === 'portal-node-portal-1' ? 420 : 0;
    });
    const offsetHeightSpy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function () {
      return (this as HTMLElement).dataset.testid === 'portal-node-portal-1' ? 320 : 0;
    });

    await act(async () => {
      root.render(
        createElement(PortalHost, {
          workspaceId: 'ws-1',
          workspaceRootDir: '/tmp/ws-1',
          node: createPortalNode(),
          onOpenRun: vi.fn(),
          onCreateBranchWorkspace: vi.fn()
        })
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(capturePortalScreenshot).not.toHaveBeenCalled();
    expect(setPortalBounds).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      nodeId: 'portal-1',
      bounds: {
        x: 40,
        y: 60,
        width: 210,
        height: 160,
        visible: true,
        scale: 0.5
      }
    });
    expect(container.querySelector('[data-testid="portal-preview-portal-1"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
    rectSpy.mockRestore();
    offsetWidthSpy.mockRestore();
    offsetHeightSpy.mockRestore();
    container.remove();
  });

  it('hides the native portal surface while connect mode is active so the node hit mask can catch clicks', async () => {
    mocked.connectModeActive = true;
    const loadPortal = vi.fn().mockResolvedValue({
      portal: {
        id: 'ws-1:portal-1',
        workspaceId: 'ws-1',
        nodeId: 'portal-1',
        url: 'https://www.baidu.com/',
        createdAtMs: 1,
        updatedAtMs: 1
      }
    });
    const setPortalBounds = vi.fn().mockResolvedValue(undefined);
    window.openweaveShell = {
      portal: {
        loadPortal,
        capturePortalScreenshot: vi.fn(),
        readPortalStructure: vi.fn(),
        clickPortalElement: vi.fn(),
        inputPortalText: vi.fn(),
        setPortalBounds,
        onPageTitleChanged: vi.fn(() => vi.fn()),
        onUrlChanged: vi.fn(() => vi.fn()),
        onNewWindow: vi.fn(() => vi.fn())
      }
    } as unknown as typeof window.openweaveShell;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      if ((this as HTMLElement).dataset.testid === 'portal-node-portal-1') {
        return {
          x: 40,
          y: 60,
          left: 40,
          top: 60,
          width: 210,
          height: 160,
          right: 250,
          bottom: 220,
          toJSON: () => {}
        } as DOMRect;
      }
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        right: 0,
        bottom: 0,
        toJSON: () => {}
      } as DOMRect;
    });
    const offsetWidthSpy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function () {
      return (this as HTMLElement).dataset.testid === 'portal-node-portal-1' ? 420 : 0;
    });
    const offsetHeightSpy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function () {
      return (this as HTMLElement).dataset.testid === 'portal-node-portal-1' ? 320 : 0;
    });

    await act(async () => {
      root.render(
        createElement(PortalHost, {
          workspaceId: 'ws-1',
          workspaceRootDir: '/tmp/ws-1',
          node: createPortalNode(),
          onOpenRun: vi.fn(),
          onCreateBranchWorkspace: vi.fn()
        })
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="portal-connect-blocker-portal-1"]')).not.toBeNull();
    expect(setPortalBounds).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      nodeId: 'portal-1',
      bounds: {
        x: 40,
        y: 60,
        width: 210,
        height: 160,
        visible: false,
        scale: 0.5
      }
    });

    await act(async () => {
      root.unmount();
    });
    rectSpy.mockRestore();
    offsetWidthSpy.mockRestore();
    offsetHeightSpy.mockRestore();
    container.remove();
  });
});
