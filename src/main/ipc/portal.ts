import path from 'node:path';
import type { IpcMainInvokeEvent } from 'electron';
import {
  IPC_CHANNELS,
  type PortalCaptureResponse,
  type PortalClickResponse,
  type PortalInputResponse,
  type PortalLoadResponse,
  type PortalStructureResponse
} from '../../shared/ipc/contracts';
import {
  portalCaptureSchema,
  portalClickSchema,
  portalInputSchema,
  portalLoadSchema,
  portalStructureSchema,
  type PortalCaptureInput,
  type PortalClickInput,
  type PortalInputInput,
  type PortalLoadInput,
  type PortalStructureInput
} from '../../shared/ipc/schemas';
import { assertPortalUrlAllowed } from '../../shared/portal/types';
import { createRegistryRepository, type RegistryRepository } from '../db/registry';
import { createPortalManager, type PortalManager } from '../portal/portal-manager';
import {
  createPortalSessionService,
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
}

export interface PortalIpcDependencies {
  assertWorkspaceExists: (workspaceId: string) => void;
  portalManager: PortalManager;
  sessionService: PortalSessionService;
}

const getSessionOrThrow = (sessionService: PortalSessionService, portalId: string) => {
  const session = sessionService.getSession(portalId);
  if (!session) {
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
      const portal = deps.sessionService.upsertSession({
        workspaceId: parsed.workspaceId,
        nodeId: parsed.nodeId,
        url: normalizedUrl
      });
      await deps.portalManager.loadUrl(portal.id, normalizedUrl);
      return { portal };
    },
    capturePortalScreenshot: async (_event: IpcMainInvokeEvent, input: PortalCaptureInput) => {
      const parsed = portalCaptureSchema.parse(input);
      const session = getSessionOrThrow(deps.sessionService, parsed.portalId);
      const screenshot = await deps.portalManager.capture(session.id, session.nodeId);
      return { screenshot };
    },
    readPortalStructure: async (_event: IpcMainInvokeEvent, input: PortalStructureInput) => {
      const parsed = portalStructureSchema.parse(input);
      const session = getSessionOrThrow(deps.sessionService, parsed.portalId);
      const structure = await deps.portalManager.readStructure(session.id);
      return { structure };
    },
    clickPortalElement: async (_event: IpcMainInvokeEvent, input: PortalClickInput) => {
      const parsed = portalClickSchema.parse(input);
      getSessionOrThrow(deps.sessionService, parsed.portalId);
      await deps.portalManager.click(parsed.portalId, parsed.selector);
      return { ok: true };
    },
    inputPortalText: async (_event: IpcMainInvokeEvent, input: PortalInputInput) => {
      const parsed = portalInputSchema.parse(input);
      getSessionOrThrow(deps.sessionService, parsed.portalId);
      await deps.portalManager.input(parsed.portalId, parsed.selector, parsed.value);
      return { ok: true };
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
  registry: RegistryRepository;
  sessionService: PortalSessionService;
  portalManager: PortalManager;
}

let registeredPortalContext: RegisteredPortalContext | null = null;

export interface RegisterPortalIpcHandlersOptions {
  dbFilePath: string;
  artifactsRootDir?: string;
  ipcMain?: PortalIpcMain;
}

export const registerPortalIpcHandlers = (options: RegisterPortalIpcHandlersOptions): void => {
  const ipcMain = options.ipcMain ?? resolveIpcMain();
  const artifactsRootDir =
    options.artifactsRootDir ?? path.join(path.dirname(options.dbFilePath), 'artifacts', 'portal');

  if (
    !registeredPortalContext ||
    registeredPortalContext.dbFilePath !== options.dbFilePath ||
    registeredPortalContext.artifactsRootDir !== artifactsRootDir
  ) {
    if (registeredPortalContext) {
      registeredPortalContext.registry.close();
      registeredPortalContext.sessionService.clear();
      registeredPortalContext.portalManager.dispose();
    }

    const registry = createRegistryRepository({ dbFilePath: options.dbFilePath });
    registeredPortalContext = {
      dbFilePath: options.dbFilePath,
      artifactsRootDir,
      registry,
      sessionService: createPortalSessionService(),
      portalManager: createPortalManager({
        artifactsRootDir
      })
    };
  }

  const context = registeredPortalContext;
  if (!context) {
    throw new Error('Portal IPC context is unavailable');
  }

  const handlers = createPortalIpcHandlers({
    assertWorkspaceExists: (workspaceId: string) => {
      if (!context.registry.hasWorkspace(workspaceId)) {
        throw new Error(`Workspace not found: ${workspaceId}`);
      }
    },
    portalManager: context.portalManager,
    sessionService: context.sessionService
  });

  ipcMain.removeHandler(IPC_CHANNELS.portalLoad);
  ipcMain.removeHandler(IPC_CHANNELS.portalCapture);
  ipcMain.removeHandler(IPC_CHANNELS.portalReadStructure);
  ipcMain.removeHandler(IPC_CHANNELS.portalClick);
  ipcMain.removeHandler(IPC_CHANNELS.portalInput);

  ipcMain.handle(IPC_CHANNELS.portalLoad, handlers.loadPortal);
  ipcMain.handle(IPC_CHANNELS.portalCapture, handlers.capturePortalScreenshot);
  ipcMain.handle(IPC_CHANNELS.portalReadStructure, handlers.readPortalStructure);
  ipcMain.handle(IPC_CHANNELS.portalClick, handlers.clickPortalElement);
  ipcMain.handle(IPC_CHANNELS.portalInput, handlers.inputPortalText);
};

export const disposePortalWorkspaceSessions = (workspaceId: string): void => {
  if (!registeredPortalContext) {
    return;
  }
  registeredPortalContext.sessionService.deleteWorkspaceSessions(workspaceId);
};

export const disposePortalIpcHandlers = (): void => {
  if (!registeredPortalContext) {
    return;
  }
  registeredPortalContext.registry.close();
  registeredPortalContext.sessionService.clear();
  registeredPortalContext.portalManager.dispose();
  registeredPortalContext = null;
};
