import crypto from 'node:crypto';
import type { IpcMainInvokeEvent } from 'electron';
import {
  IPC_CHANNELS,
  type RunGetResponse,
  type RunListResponse,
  type RunMutationResponse,
  type RunRecord
} from '../../shared/ipc/contracts';
import {
  runGetSchema,
  runListSchema,
  runStartSchema,
  workspaceIdSchema,
  type RunGetInput,
  type RunListInput,
  type RunStartInput,
  type RunStatusInput
} from '../../shared/ipc/schemas';
import { createRegistryRepository, type RegistryRepository } from '../db/registry';
import {
  createRuntimeBridge,
  type RuntimeBridge,
  type RuntimeExitEvent,
  type RuntimeStreamEvent
} from '../runtime/runtime-bridge';

interface RunsIpcMain {
  handle: (channel: string, listener: (...args: any[]) => unknown) => void;
  removeHandler: (channel: string) => void;
}

export interface RunsIpcHandlers {
  startRun: (_event: IpcMainInvokeEvent, input: RunStartInput) => Promise<RunMutationResponse>;
  getRun: (_event: IpcMainInvokeEvent, input: RunGetInput) => Promise<RunGetResponse>;
  listRuns: (_event: IpcMainInvokeEvent, input: RunListInput) => Promise<RunListResponse>;
}

export interface RunsIpcDependencies {
  assertWorkspaceExists: (workspaceId: string) => void;
  runtimeBridge?: RuntimeBridge;
  now?: () => number;
  randomId?: () => string;
  launchEnv?: NodeJS.ProcessEnv;
}

interface RunsServiceOptions {
  assertWorkspaceExists: (workspaceId: string) => void;
  runtimeBridge: RuntimeBridge;
  now: () => number;
  randomId: () => string;
  launchEnv: NodeJS.ProcessEnv;
}

const MAX_TAIL_LOG_LENGTH = 4096;

const appendTailLog = (tail: string, chunk: string): string => {
  const nextTail = `${tail}${chunk}`;
  if (nextTail.length <= MAX_TAIL_LOG_LENGTH) {
    return nextTail;
  }
  return nextTail.slice(nextTail.length - MAX_TAIL_LOG_LENGTH);
};

const buildSummary = (tailLog: string): string => {
  const nonEmptyLines = tailLog
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (nonEmptyLines.length === 0) {
    return 'Run finished';
  }

  return nonEmptyLines[nonEmptyLines.length - 1];
};

class InMemoryRunsService {
  private readonly runs = new Map<string, RunRecord>();

  private readonly assertWorkspaceExists: (workspaceId: string) => void;

  private readonly runtimeBridge: RuntimeBridge;

  private readonly now: () => number;

  private readonly randomId: () => string;

  private readonly launchEnv: NodeJS.ProcessEnv;

  constructor(options: RunsServiceOptions) {
    this.assertWorkspaceExists = options.assertWorkspaceExists;
    this.runtimeBridge = options.runtimeBridge;
    this.now = options.now;
    this.randomId = options.randomId;
    this.launchEnv = options.launchEnv;

    this.runtimeBridge.on('started', (event) => {
      const run = this.runs.get(event.runId);
      if (!run) {
        return;
      }

      this.runs.set(event.runId, {
        ...run,
        status: 'running',
        startedAtMs: run.startedAtMs ?? this.now()
      });
    });

    this.runtimeBridge.on('stdout', (event) => {
      this.appendOutput(event);
    });

    this.runtimeBridge.on('stderr', (event) => {
      this.appendOutput(event);
    });

    this.runtimeBridge.on('exit', (event) => {
      this.completeRun(event);
    });
  }

  public startRun(input: RunStartInput): RunRecord {
    const parsed = runStartSchema.parse(input);
    this.assertWorkspaceExists(parsed.workspaceId);

    const run: RunRecord = {
      id: this.randomId(),
      workspaceId: parsed.workspaceId,
      nodeId: parsed.nodeId,
      runtime: parsed.runtime,
      command: parsed.command,
      status: 'queued',
      summary: null,
      tailLog: '',
      createdAtMs: this.now(),
      startedAtMs: null,
      completedAtMs: null
    };

    this.runs.set(run.id, run);
    this.runtimeBridge.start({
      runId: run.id,
      runtime: run.runtime,
      command: run.command,
      env: this.launchEnv
    });
    return run;
  }

  public getRun(input: RunGetInput): RunRecord {
    const parsed = runGetSchema.parse(input);
    const run = this.runs.get(parsed.runId);
    if (!run) {
      throw new Error(`Run not found: ${parsed.runId}`);
    }
    return run;
  }

  public listRuns(input: RunListInput): RunRecord[] {
    const parsed = runListSchema.parse(input);
    this.assertWorkspaceExists(parsed.workspaceId);

    return [...this.runs.values()]
      .filter((run) => run.workspaceId === parsed.workspaceId && run.nodeId === parsed.nodeId)
      .sort((left, right) => right.createdAtMs - left.createdAtMs);
  }

  public dispose(): void {
    this.runtimeBridge.dispose();
    this.runs.clear();
  }

  private appendOutput(event: RuntimeStreamEvent): void {
    const run = this.runs.get(event.runId);
    if (!run) {
      return;
    }

    this.runs.set(event.runId, {
      ...run,
      tailLog: appendTailLog(run.tailLog, event.chunk)
    });
  }

  private completeRun(event: RuntimeExitEvent): void {
    const run = this.runs.get(event.runId);
    if (!run) {
      return;
    }

    const status: RunStatusInput = event.code === 0 ? 'completed' : 'failed';
    const tailLog = appendTailLog(run.tailLog, event.tail);
    const summary = buildSummary(tailLog);
    this.runs.set(event.runId, {
      ...run,
      status,
      tailLog,
      summary,
      completedAtMs: this.now()
    });
  }
}

export const createRunsIpcHandlers = (deps: RunsIpcDependencies): RunsIpcHandlers => {
  const service = new InMemoryRunsService({
    assertWorkspaceExists: deps.assertWorkspaceExists,
    runtimeBridge: deps.runtimeBridge ?? createRuntimeBridge(),
    now: deps.now ?? (() => Date.now()),
    randomId: deps.randomId ?? (() => crypto.randomUUID()),
    launchEnv: deps.launchEnv ?? process.env
  });

  return {
    startRun: async (_event: IpcMainInvokeEvent, input: RunStartInput) => {
      return {
        run: service.startRun(input)
      };
    },
    getRun: async (_event: IpcMainInvokeEvent, input: RunGetInput) => {
      return {
        run: service.getRun(input)
      };
    },
    listRuns: async (_event: IpcMainInvokeEvent, input: RunListInput) => {
      return {
        runs: service.listRuns(input)
      };
    }
  };
};

const resolveIpcMain = (): RunsIpcMain => {
  const { ipcMain } = require('electron') as typeof import('electron');
  return ipcMain;
};

interface RegisteredRunsContext {
  dbFilePath: string;
  registry: RegistryRepository;
  service: InMemoryRunsService;
}

let registeredRunsContext: RegisteredRunsContext | null = null;

export interface RegisterRunsIpcHandlersOptions {
  dbFilePath: string;
  ipcMain?: RunsIpcMain;
  runtimeBridge?: RuntimeBridge;
}

export const registerRunsIpcHandlers = (options: RegisterRunsIpcHandlersOptions): void => {
  const ipcMain = options.ipcMain ?? resolveIpcMain();

  if (!registeredRunsContext || registeredRunsContext.dbFilePath !== options.dbFilePath) {
    if (registeredRunsContext) {
      registeredRunsContext.service.dispose();
      registeredRunsContext.registry.close();
    }

    const registry = createRegistryRepository({ dbFilePath: options.dbFilePath });
    registeredRunsContext = {
      dbFilePath: options.dbFilePath,
      registry,
      service: new InMemoryRunsService({
        assertWorkspaceExists: (workspaceId: string) => {
          const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId);
          if (!registry.hasWorkspace(parsedWorkspaceId)) {
            throw new Error(`Workspace not found: ${parsedWorkspaceId}`);
          }
        },
        runtimeBridge: options.runtimeBridge ?? createRuntimeBridge(),
        now: () => Date.now(),
        randomId: () => crypto.randomUUID(),
        launchEnv: process.env
      })
    };
  }

  const context = registeredRunsContext;
  if (!context) {
    throw new Error('Runs IPC context is unavailable');
  }

  const handlers: RunsIpcHandlers = {
    startRun: async (_event: IpcMainInvokeEvent, input: RunStartInput) => {
      return {
        run: context.service.startRun(input)
      };
    },
    getRun: async (_event: IpcMainInvokeEvent, input: RunGetInput) => {
      return {
        run: context.service.getRun(input)
      };
    },
    listRuns: async (_event: IpcMainInvokeEvent, input: RunListInput) => {
      return {
        runs: context.service.listRuns(input)
      };
    }
  };

  ipcMain.removeHandler(IPC_CHANNELS.runStart);
  ipcMain.removeHandler(IPC_CHANNELS.runGet);
  ipcMain.removeHandler(IPC_CHANNELS.runList);
  ipcMain.handle(IPC_CHANNELS.runStart, handlers.startRun);
  ipcMain.handle(IPC_CHANNELS.runGet, handlers.getRun);
  ipcMain.handle(IPC_CHANNELS.runList, handlers.listRuns);
};

export const disposeRunsIpcHandlers = (): void => {
  if (!registeredRunsContext) {
    return;
  }
  registeredRunsContext.service.dispose();
  registeredRunsContext.registry.close();
  registeredRunsContext = null;
};
