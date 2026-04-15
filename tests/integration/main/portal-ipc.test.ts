import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it } from 'vitest';
import { createPortalIpcHandlers, type PortalIpcHandlers } from '../../../src/main/ipc/portal';
import { createPortalSessionService } from '../../../src/main/portal/portal-session-service';
import type {
  PortalManager,
  PortalScreenshotResult,
  PortalStructureResult
} from '../../../src/main/portal/portal-manager';

class StubPortalManager implements PortalManager {
  public readonly loaded = new Map<string, string>();

  public async loadUrl(portalId: string, url: string): Promise<void> {
    this.loaded.set(portalId, url);
  }

  public async capture(portalId: string, nodeId: string): Promise<PortalScreenshotResult> {
    return {
      path: `/tmp/openweave/artifacts/portal/${nodeId}/${portalId}.png`,
      takenAtMs: Date.now()
    };
  }

  public async readStructure(_portalId: string): Promise<PortalStructureResult> {
    return {
      elements: [{ tag: 'button', text: 'submit' }]
    };
  }

  public async click(_portalId: string, _selector: string): Promise<void> {}

  public async input(_portalId: string, _selector: string, _value: string): Promise<void> {}

  public dispose(): void {}
}

const assertWorkspaceExists = (workspaceId: string): void => {
  if (workspaceId !== 'ws-1') {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }
};

describe('portal IPC flow', () => {
  it('loads a portal url, captures a screenshot, and returns a simplified structure tree', async () => {
    const handlers: PortalIpcHandlers = createPortalIpcHandlers({
      assertWorkspaceExists,
      portalManager: new StubPortalManager(),
      sessionService: createPortalSessionService()
    });

    const portal = await handlers.loadPortal({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      nodeId: 'portal-1',
      url: 'http://127.0.0.1:3000'
    });
    const screenshot = await handlers.capturePortalScreenshot({} as IpcMainInvokeEvent, {
      portalId: portal.portal.id
    });
    const structure = await handlers.readPortalStructure({} as IpcMainInvokeEvent, {
      portalId: portal.portal.id
    });

    expect(screenshot.screenshot.path).toContain('artifacts/portal/portal-1');
    expect(structure.structure.elements.length).toBeGreaterThan(0);
  });

  it('rejects disallowed portal urls such as file://', async () => {
    const handlers: PortalIpcHandlers = createPortalIpcHandlers({
      assertWorkspaceExists,
      portalManager: new StubPortalManager(),
      sessionService: createPortalSessionService()
    });

    await expect(
      handlers.loadPortal({} as IpcMainInvokeEvent, {
        workspaceId: 'ws-1',
        nodeId: 'portal-2',
        url: 'file:///tmp/demo.html'
      })
    ).rejects.toThrow('URL scheme not allowed');
  });
});
