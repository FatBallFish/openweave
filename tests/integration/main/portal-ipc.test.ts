import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { IpcMainInvokeEvent } from 'electron';
import { describe, expect, it } from 'vitest';
import { createPortalIpcHandlers, type PortalIpcHandlers } from '../../../src/main/ipc/portal';
import {
  createPortalSessionService,
  toPortalSessionId
} from '../../../src/main/portal/portal-session-service';
import type {
  PortalManager,
  PortalScreenshotResult,
  PortalStructureResult
} from '../../../src/main/portal/portal-manager';

class StubPortalManager implements PortalManager {
  public readonly loaded = new Map<string, string>();
  public readonly disposedPortalIds: string[] = [];
  public failNextLoad = false;

  public async loadUrl(portalId: string, url: string): Promise<void> {
    if (this.failNextLoad) {
      this.failNextLoad = false;
      throw new Error('load failure');
    }
    this.loaded.set(portalId, url);
  }

  public async capture(
    portalId: string,
    workspaceId: string,
    nodeId: string
  ): Promise<PortalScreenshotResult> {
    return {
      path: `/tmp/openweave/artifacts/portal/${workspaceId}/${nodeId}/${portalId}.png`,
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

  public disposePortal(portalId: string): void {
    this.disposedPortalIds.push(portalId);
    this.loaded.delete(portalId);
  }

  public dispose(): void {}
}

const assertWorkspaceExists = (workspaceId: string): void => {
  if (workspaceId !== 'ws-1' && workspaceId !== 'ws-2') {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }
};

describe('portal IPC flow', () => {
  it('loads a portal url, captures a screenshot, and returns a simplified structure tree', async () => {
    const manager = new StubPortalManager();
    const artifactsRootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-portal-artifacts-'));
    const handlers: PortalIpcHandlers = createPortalIpcHandlers({
      assertWorkspaceExists,
      portalManager: manager,
      sessionService: createPortalSessionService(),
      cleanupWorkspaceArtifacts: (workspaceId: string) => {
        fs.rmSync(path.join(artifactsRootDir, workspaceId), { recursive: true, force: true });
      }
    });

    const portal = await handlers.loadPortal({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      nodeId: 'portal-1',
      url: 'http://127.0.0.1:3000'
    });
    const screenshot = await handlers.capturePortalScreenshot({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      portalId: portal.portal.id
    });
    const structure = await handlers.readPortalStructure({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      portalId: portal.portal.id
    });

    expect(screenshot.screenshot.path).toContain('artifacts/portal/ws-1/portal-1');
    expect(structure.structure.elements.length).toBeGreaterThan(0);
    expect(manager.loaded.get(portal.portal.id)).toBe('http://127.0.0.1:3000/');
  });

  it('rejects disallowed portal urls such as file://', async () => {
    const handlers: PortalIpcHandlers = createPortalIpcHandlers({
      assertWorkspaceExists,
      portalManager: new StubPortalManager(),
      sessionService: createPortalSessionService(),
      cleanupWorkspaceArtifacts: () => {}
    });

    await expect(
      handlers.loadPortal({} as IpcMainInvokeEvent, {
        workspaceId: 'ws-1',
        nodeId: 'portal-2',
        url: 'file:///tmp/demo.html'
      })
    ).rejects.toThrow('URL scheme not allowed');
  });

  it('allows remote https urls in MVP while still rejecting file://', async () => {
    const manager = new StubPortalManager();
    const handlers: PortalIpcHandlers = createPortalIpcHandlers({
      assertWorkspaceExists,
      portalManager: manager,
      sessionService: createPortalSessionService(),
      cleanupWorkspaceArtifacts: () => {}
    });

    const loaded = await handlers.loadPortal({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      nodeId: 'portal-remote',
      url: 'https://example.com/demo'
    });

    expect(loaded.portal.url).toBe('https://example.com/demo');
    expect(manager.loaded.get(loaded.portal.id)).toBe('https://example.com/demo');
  });

  it('rejects cross-workspace capture/read/click/input access for an existing portal id', async () => {
    const handlers: PortalIpcHandlers = createPortalIpcHandlers({
      assertWorkspaceExists,
      portalManager: new StubPortalManager(),
      sessionService: createPortalSessionService(),
      cleanupWorkspaceArtifacts: () => {}
    });
    const loaded = await handlers.loadPortal({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      nodeId: 'portal-owner',
      url: 'http://127.0.0.1:3000'
    });
    const portalId = loaded.portal.id;

    await expect(
      handlers.capturePortalScreenshot({} as IpcMainInvokeEvent, {
        workspaceId: 'ws-2',
        portalId
      })
    ).rejects.toThrow(`Portal session not found: ${portalId}`);

    await expect(
      handlers.readPortalStructure({} as IpcMainInvokeEvent, {
        workspaceId: 'ws-2',
        portalId
      })
    ).rejects.toThrow(`Portal session not found: ${portalId}`);

    await expect(
      handlers.clickPortalElement({} as IpcMainInvokeEvent, {
        workspaceId: 'ws-2',
        portalId,
        selector: '#x'
      })
    ).rejects.toThrow(`Portal session not found: ${portalId}`);

    await expect(
      handlers.inputPortalText({} as IpcMainInvokeEvent, {
        workspaceId: 'ws-2',
        portalId,
        selector: '#x',
        value: 'hello'
      })
    ).rejects.toThrow(`Portal session not found: ${portalId}`);
  });

  it('rolls back loadPortal session mutation when loadURL fails', async () => {
    const manager = new StubPortalManager();
    manager.failNextLoad = true;
    const sessionService = createPortalSessionService();
    const handlers: PortalIpcHandlers = createPortalIpcHandlers({
      assertWorkspaceExists,
      portalManager: manager,
      sessionService,
      cleanupWorkspaceArtifacts: () => {}
    });
    const portalId = toPortalSessionId('ws-1', 'portal-fail');

    await expect(
      handlers.loadPortal({} as IpcMainInvokeEvent, {
        workspaceId: 'ws-1',
        nodeId: 'portal-fail',
        url: 'https://example.com'
      })
    ).rejects.toThrow('load failure');

    expect(sessionService.getSession(portalId)).toBeNull();
  });

  it('disposes workspace runtime sessions and cleans workspace artifacts on delete', async () => {
    const manager = new StubPortalManager();
    const sessionService = createPortalSessionService();
    const artifactsRootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-portal-cleanup-'));
    const handlers: PortalIpcHandlers = createPortalIpcHandlers({
      assertWorkspaceExists,
      portalManager: manager,
      sessionService,
      cleanupWorkspaceArtifacts: (workspaceId: string) => {
        fs.rmSync(path.join(artifactsRootDir, workspaceId), { recursive: true, force: true });
      }
    });

    const ws1 = await handlers.loadPortal({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-1',
      nodeId: 'portal-a',
      url: 'http://127.0.0.1:3000'
    });
    const ws2 = await handlers.loadPortal({} as IpcMainInvokeEvent, {
      workspaceId: 'ws-2',
      nodeId: 'portal-b',
      url: 'http://127.0.0.1:3000'
    });

    fs.mkdirSync(path.join(artifactsRootDir, 'ws-1'), { recursive: true });
    fs.writeFileSync(path.join(artifactsRootDir, 'ws-1', 'a.png'), 'a');
    fs.mkdirSync(path.join(artifactsRootDir, 'ws-2'), { recursive: true });
    fs.writeFileSync(path.join(artifactsRootDir, 'ws-2', 'b.png'), 'b');

    handlers.disposeWorkspaceState('ws-1');

    expect(manager.disposedPortalIds).toContain(ws1.portal.id);
    expect(manager.disposedPortalIds).not.toContain(ws2.portal.id);
    expect(sessionService.getSession(ws1.portal.id)).toBeNull();
    expect(sessionService.getSession(ws2.portal.id)).not.toBeNull();
    expect(fs.existsSync(path.join(artifactsRootDir, 'ws-1'))).toBe(false);
    expect(fs.existsSync(path.join(artifactsRootDir, 'ws-2'))).toBe(true);

    fs.rmSync(artifactsRootDir, { recursive: true, force: true });
  });
});
