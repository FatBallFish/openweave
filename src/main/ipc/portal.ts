import fs from 'node:fs';
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
  workspaceIdSchema,
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

  ipcMain.handle(IPC_CHANNELS.portalLoad, handlers.loadPortal);
  ipcMain.handle(IPC_CHANNELS.portalCapture, handlers.capturePortalScreenshot);
  ipcMain.handle(IPC_CHANNELS.portalReadStructure, handlers.readPortalStructure);
  ipcMain.handle(IPC_CHANNELS.portalClick, handlers.clickPortalElement);
  ipcMain.handle(IPC_CHANNELS.portalInput, handlers.inputPortalText);
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
  registeredPortalContext.registry.close();
  registeredPortalContext.sessionService.clear();
  registeredPortalContext.portalManager.dispose();
  registeredPortalContext = null;
};
