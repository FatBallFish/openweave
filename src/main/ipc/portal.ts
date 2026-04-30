import fs from 'node:fs';
import path from 'node:path';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import {
  IPC_CHANNELS,
  type PortalCaptureResponse,
  type PortalClickResponse,
  type PortalBoundsResponse,
  type PortalInputResponse,
  type PortalLoadResponse,
  type PortalStructureResponse
} from '../../shared/ipc/contracts';
import {
  portalCaptureSchema,
  portalClickSchema,
  portalBoundsSchema,
  portalInputSchema,
  workspaceIdSchema,
  portalLoadSchema,
  portalStructureSchema,
  type PortalCaptureInput,
  type PortalClickInput,
  type PortalBoundsInput,
  type PortalInputInput,
  type PortalLoadInput,
  type PortalStructureInput
} from '../../shared/ipc/schemas';
import { assertPortalUrlAllowed } from '../../shared/portal/types';
import { createRegistryRepository, type RegistryRepository } from '../db/registry';
import { startPortalActionFileServer } from '../bridge/portal-action-file-bridge';
import { createPortalManager, type PortalManager } from '../portal/portal-manager';
import {
  createPortalSessionService,
  toPortalSessionId,
  type PortalSessionService
} from '../portal/portal-session-service';

interface PortalIpcMain {
  handle: (channel: string, listener: (...args: any[]) => unknown) => void;
  removeHandler: (channel: string) => void;
}

export interface PortalIpcHandlers {
  loadPortal: (_event: IpcMainInvokeEvent, input: PortalLoadInput) => Promise<PortalLoadResponse>;
  capturePortalScreenshot: (
    _event: IpcMainInvokeEvent,
    input: PortalCaptureInput
  ) => Promise<PortalCaptureResponse>;
  readPortalStructure: (
    _event: IpcMainInvokeEvent,
    input: PortalStructureInput
  ) => Promise<PortalStructureResponse>;
  clickPortalElement: (
    _event: IpcMainInvokeEvent,
    input: PortalClickInput
  ) => Promise<PortalClickResponse>;
  inputPortalText: (_event: IpcMainInvokeEvent, input: PortalInputInput) => Promise<PortalInputResponse>;
  setPortalBounds: (_event: IpcMainInvokeEvent, input: PortalBoundsInput) => Promise<PortalBoundsResponse>;
  disposeWorkspaceState: (workspaceId: string) => void;
}

export interface PortalIpcDependencies {
  assertWorkspaceExists: (workspaceId: string) => void;
  portalManager: PortalManager;
  sessionService: PortalSessionService;
  cleanupWorkspaceArtifacts: (workspaceId: string) => void;
}

const getOwnedSessionOrThrow = (
  sessionService: PortalSessionService,
  workspaceId: string,
  portalId: string
) => {
  const session = sessionService.getSession(portalId);
  if (!session || session.workspaceId !== workspaceId) {
    throw new Error(`Portal session not found: ${portalId}`);
  }
  return session;
};

export const createPortalIpcHandlers = (deps: PortalIpcDependencies): PortalIpcHandlers => {
  return {
    loadPortal: async (_event: IpcMainInvokeEvent, input: PortalLoadInput) => {
      const parsed = portalLoadSchema.parse(input);
      deps.assertWorkspaceExists(parsed.workspaceId);
      const normalizedUrl = assertPortalUrlAllowed(parsed.url);
      const portalId = toPortalSessionId(parsed.workspaceId, parsed.nodeId);
      await deps.portalManager.loadUrl(portalId, normalizedUrl);
      const portal = deps.sessionService.upsertSession({
        workspaceId: parsed.workspaceId,
        nodeId: parsed.nodeId,
        url: normalizedUrl
      });
      return { portal };
    },
    capturePortalScreenshot: async (_event: IpcMainInvokeEvent, input: PortalCaptureInput) => {
      const parsed = portalCaptureSchema.parse(input);
      deps.assertWorkspaceExists(parsed.workspaceId);
      const session = getOwnedSessionOrThrow(deps.sessionService, parsed.workspaceId, parsed.portalId);
      const screenshot = await deps.portalManager.capture(
        session.id,
        session.workspaceId,
        session.nodeId
      );
      return { screenshot };
    },
    readPortalStructure: async (_event: IpcMainInvokeEvent, input: PortalStructureInput) => {
      const parsed = portalStructureSchema.parse(input);
      deps.assertWorkspaceExists(parsed.workspaceId);
      const session = getOwnedSessionOrThrow(deps.sessionService, parsed.workspaceId, parsed.portalId);
      const structure = await deps.portalManager.readStructure(session.id);
      return { structure };
    },
    clickPortalElement: async (_event: IpcMainInvokeEvent, input: PortalClickInput) => {
      const parsed = portalClickSchema.parse(input);
      deps.assertWorkspaceExists(parsed.workspaceId);
      getOwnedSessionOrThrow(deps.sessionService, parsed.workspaceId, parsed.portalId);
      await deps.portalManager.click(parsed.portalId, parsed.selector);
      return { ok: true };
    },
    inputPortalText: async (_event: IpcMainInvokeEvent, input: PortalInputInput) => {
      const parsed = portalInputSchema.parse(input);
      deps.assertWorkspaceExists(parsed.workspaceId);
      getOwnedSessionOrThrow(deps.sessionService, parsed.workspaceId, parsed.portalId);
      await deps.portalManager.input(parsed.portalId, parsed.selector, parsed.value);
      return { ok: true };
    },
    setPortalBounds: async (_event: IpcMainInvokeEvent, input: PortalBoundsInput) => {
      const parsed = portalBoundsSchema.parse(input);
      deps.assertWorkspaceExists(parsed.workspaceId);
      deps.portalManager.setBounds(toPortalSessionId(parsed.workspaceId, parsed.nodeId), parsed.bounds);
      return { ok: true };
    },
    disposeWorkspaceState: (workspaceId: string): void => {
      const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId);
      const sessions = deps.sessionService.listWorkspaceSessions(parsedWorkspaceId);
      for (const session of sessions) {
        deps.portalManager.disposePortal(session.id);
      }
      deps.sessionService.deleteWorkspaceSessions(parsedWorkspaceId);
      deps.cleanupWorkspaceArtifacts(parsedWorkspaceId);
    }
  };
};

const resolveIpcMain = (): PortalIpcMain => {
  const { ipcMain } = require('electron') as typeof import('electron');
  return ipcMain;
};

interface RegisteredPortalContext {
  dbFilePath: string;
  artifactsRootDir: string;
  portalActionRequestsDir: string;
  registry: RegistryRepository;
  sessionService: PortalSessionService;
  portalManager: PortalManager;
  stopPortalActionServer: (() => void) | null;
}

let registeredPortalContext: RegisteredPortalContext | null = null;

export interface RegisterPortalIpcHandlersOptions {
  dbFilePath: string;
  artifactsRootDir?: string;
  portalActionRequestsDir?: string;
  ipcMain?: PortalIpcMain;
  getHostWindow?: () => BrowserWindow | null;
  sendToRenderer?: (channel: string, ...args: unknown[]) => void;
}

export const registerPortalIpcHandlers = (options: RegisterPortalIpcHandlersOptions): void => {
  const ipcMain = options.ipcMain ?? resolveIpcMain();
  const artifactsRootDir =
    options.artifactsRootDir ?? path.join(path.dirname(options.dbFilePath), 'artifacts', 'portal');
  const portalActionRequestsDir =
    options.portalActionRequestsDir ?? path.join(path.dirname(options.dbFilePath), 'portal-action-requests');

  if (
    !registeredPortalContext ||
    registeredPortalContext.dbFilePath !== options.dbFilePath ||
    registeredPortalContext.artifactsRootDir !== artifactsRootDir ||
    registeredPortalContext.portalActionRequestsDir !== portalActionRequestsDir
  ) {
    if (registeredPortalContext) {
      registeredPortalContext.stopPortalActionServer?.();
      registeredPortalContext.registry.close();
      registeredPortalContext.sessionService.clear();
      registeredPortalContext.portalManager.dispose();
    }

    const registry = createRegistryRepository({ dbFilePath: options.dbFilePath });
    registeredPortalContext = {
      dbFilePath: options.dbFilePath,
      artifactsRootDir,
      portalActionRequestsDir,
      registry,
      sessionService: createPortalSessionService(),
      portalManager: createPortalManager({
        artifactsRootDir,
        getHostWindow: options.getHostWindow
      }),
      stopPortalActionServer: null
    };
  }

  const context = registeredPortalContext;
  if (!context) {
    throw new Error('Portal IPC context is unavailable');
  }

  const cleanupWorkspaceArtifacts = (workspaceId: string): void => {
    const normalizedWorkspaceId = workspaceIdSchema.parse(workspaceId);
    const workspaceArtifactsDir = path.join(
      context.artifactsRootDir,
      normalizedWorkspaceId.replace(/[^a-zA-Z0-9_-]/g, '-')
    );
    fs.rmSync(workspaceArtifactsDir, { recursive: true, force: true });
  };

  const handlers = createPortalIpcHandlers({
    assertWorkspaceExists: (workspaceId: string) => {
      if (!context.registry.hasWorkspace(workspaceId)) {
        throw new Error(`Workspace not found: ${workspaceId}`);
      }
    },
    portalManager: context.portalManager,
    sessionService: context.sessionService,
    cleanupWorkspaceArtifacts
  });

  ipcMain.removeHandler(IPC_CHANNELS.portalLoad);
  ipcMain.removeHandler(IPC_CHANNELS.portalCapture);
  ipcMain.removeHandler(IPC_CHANNELS.portalReadStructure);
  ipcMain.removeHandler(IPC_CHANNELS.portalClick);
  ipcMain.removeHandler(IPC_CHANNELS.portalInput);
  ipcMain.removeHandler(IPC_CHANNELS.portalSetBounds);

  ipcMain.handle(IPC_CHANNELS.portalLoad, handlers.loadPortal);
  ipcMain.handle(IPC_CHANNELS.portalCapture, handlers.capturePortalScreenshot);
  ipcMain.handle(IPC_CHANNELS.portalReadStructure, handlers.readPortalStructure);
  ipcMain.handle(IPC_CHANNELS.portalClick, handlers.clickPortalElement);
  ipcMain.handle(IPC_CHANNELS.portalInput, handlers.inputPortalText);
  ipcMain.handle(IPC_CHANNELS.portalSetBounds, handlers.setPortalBounds);

  context.stopPortalActionServer?.();
  context.stopPortalActionServer = startPortalActionFileServer({
    requestsDir: context.portalActionRequestsDir,
    dispatch: async (input) => {
      const portalId = toPortalSessionId(input.workspaceId, input.targetNodeId);
      const payload = input.payload ?? {};

      switch (input.action) {
        case 'navigate': {
          const url = typeof payload.url === 'string' ? payload.url : '';
          const response = await handlers.loadPortal({} as IpcMainInvokeEvent, {
            workspaceId: input.workspaceId,
            nodeId: input.targetNodeId,
            url
          });
          return {
            loaded: true,
            url: response.portal.url
          };
        }
        case 'capture': {
          const response = await handlers.capturePortalScreenshot({} as IpcMainInvokeEvent, {
            workspaceId: input.workspaceId,
            portalId
          });
          return response.screenshot;
        }
        case 'read-structure': {
          const response = await handlers.readPortalStructure({} as IpcMainInvokeEvent, {
            workspaceId: input.workspaceId,
            portalId
          });
          return response.structure;
        }
        case 'click': {
          const selector = typeof payload.selector === 'string' ? payload.selector : '';
          await handlers.clickPortalElement({} as IpcMainInvokeEvent, {
            workspaceId: input.workspaceId,
            portalId,
            selector
          });
          return { clicked: true };
        }
        case 'input': {
          const selector = typeof payload.selector === 'string' ? payload.selector : '';
          const value = typeof payload.value === 'string' ? payload.value : '';
          await handlers.inputPortalText({} as IpcMainInvokeEvent, {
            workspaceId: input.workspaceId,
            portalId,
            selector,
            value
          });
          return { applied: true };
        }
        default:
          throw new Error(`NODE_ACTION_NOT_SUPPORTED: ${input.action}`);
      }
    }
  });

  context.portalManager.onTitleChanged((portalId, title) => {
    options.sendToRenderer?.(IPC_CHANNELS.portalPageTitleChanged, { portalId, title });
  });

  context.portalManager.onUrlChanged((portalId, url) => {
    options.sendToRenderer?.(IPC_CHANNELS.portalUrlChanged, { portalId, url });
  });

  context.portalManager.onNewWindow((parentPortalId, url) => {
    options.sendToRenderer?.(IPC_CHANNELS.portalNewWindow, { parentPortalId, url });
  });
};

export const disposePortalWorkspaceState = (workspaceId: string): void => {
  if (!registeredPortalContext) {
    return;
  }
  const handlers = createPortalIpcHandlers({
    assertWorkspaceExists: () => {
      // Workspace may already be deleted; cleanup still needs to run.
    },
    portalManager: registeredPortalContext.portalManager,
    sessionService: registeredPortalContext.sessionService,
    cleanupWorkspaceArtifacts: (normalizedWorkspaceId: string) => {
      const workspaceArtifactsDir = path.join(
        registeredPortalContext!.artifactsRootDir,
        normalizedWorkspaceId.replace(/[^a-zA-Z0-9_-]/g, '-')
      );
      fs.rmSync(workspaceArtifactsDir, { recursive: true, force: true });
    }
  });
  handlers.disposeWorkspaceState(workspaceId);
};

export const disposePortalIpcHandlers = (): void => {
  if (!registeredPortalContext) {
    return;
  }
  registeredPortalContext.stopPortalActionServer?.();
  registeredPortalContext.registry.close();
  registeredPortalContext.sessionService.clear();
  registeredPortalContext.portalManager.dispose();
  registeredPortalContext = null;
};
