import crypto from 'node:crypto';
import path from 'node:path';
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
import { createAuditLog } from '../audit/audit-log';
import { createRegistryRepository, type RegistryRepository } from '../db/registry';
import { createWorkspaceRepository } from '../db/workspace';
import { createRecoveryService } from '../recovery/recovery-service';
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
  disposeWorkspaceRuns: (workspaceId: string) => void;
}

export interface RunsIpcDependencies {
  assertWorkspaceExists: (workspaceId: string) => void;
  resolveWorkspaceRootDir?: (workspaceId: string) => string;
  runtimeBridge?: RuntimeBridge;
  now?: () => number;
  randomId?: () => string;
  launchEnv?: NodeJS.ProcessEnv;
}

interface RunsServiceOptions {
  assertWorkspaceExists: (workspaceId: string) => void;
  resolveWorkspaceRootDir?: (workspaceId: string) => string;
  runtimeBridge: RuntimeBridge;
  now: () => number;
  randomId: () => string;
  launchEnv: NodeJS.ProcessEnv;
  onRunUpdated?: (run: RunRecord) => void;
}

const MAX_TAIL_LOG_LENGTH = 4096;
const MAX_STORED_RUNS = 200;
const MAX_LISTED_RUNS = 100;

const isTerminalRunStatus = (status: RunStatusInput): boolean => {
  return status === 'completed' || status === 'failed';
};

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

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Runtime launch failed';
};

class InMemoryRunsService {
  private readonly runs = new Map<string, RunRecord>();

  private readonly assertWorkspaceExists: (workspaceId: string) => void;

  private readonly resolveWorkspaceRootDir?: (workspaceId: string) => string;

  private readonly runtimeBridge: RuntimeBridge;

  private readonly now: () => number;

  private readonly randomId: () => string;

  private readonly launchEnv: NodeJS.ProcessEnv;

  private readonly onRunUpdated?: (run: RunRecord) => void;

  constructor(options: RunsServiceOptions) {
    this.assertWorkspaceExists = options.assertWorkspaceExists;
    this.resolveWorkspaceRootDir = options.resolveWorkspaceRootDir;
    this.runtimeBridge = options.runtimeBridge;
    this.now = options.now;
    this.randomId = options.randomId;
    this.launchEnv = options.launchEnv;
    this.onRunUpdated = options.onRunUpdated;

    this.runtimeBridge.on('started', (event) => {
      const run = this.runs.get(event.runId);
      if (!run || isTerminalRunStatus(run.status)) {
        return;
      }

      this.storeRun({
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
    const workspaceRootDir = this.resolveWorkspaceRootDir?.(parsed.workspaceId);

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

    this.storeRun(run);

    try {
      this.runtimeBridge.start({
        runId: run.id,
        runtime: run.runtime,
        command: run.command,
        cwd: workspaceRootDir,
        env: this.launchEnv
      });
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      const failedRun: RunRecord = {
        ...run,
        status: 'failed',
        summary: errorMessage,
        tailLog: appendTailLog('', `${errorMessage}\n`),
        completedAtMs: this.now()
      };
      this.storeRun(failedRun);
      this.pruneStoredRuns();
      return failedRun;
    }

    this.pruneStoredRuns();
    return run;
  }

  public getRun(input: RunGetInput): RunRecord {
    const parsed = runGetSchema.parse(input);
    this.assertWorkspaceExists(parsed.workspaceId);

    const run = this.runs.get(parsed.runId);
    if (!run || run.workspaceId !== parsed.workspaceId) {
      throw new Error(`Run not found: ${parsed.runId}`);
    }
    return run;
  }

  public listRuns(input: RunListInput): RunRecord[] {
    const parsed = runListSchema.parse(input);
    this.assertWorkspaceExists(parsed.workspaceId);

    return [...this.runs.values()]
      .filter((run) => run.workspaceId === parsed.workspaceId && run.nodeId === parsed.nodeId)
      .sort((left, right) => right.createdAtMs - left.createdAtMs)
      .slice(0, MAX_LISTED_RUNS);
  }

  public disposeWorkspaceRuns(workspaceId: string): void {
    const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId);
    const runIds: string[] = [];

    for (const run of this.runs.values()) {
      if (run.workspaceId !== parsedWorkspaceId) {
        continue;
      }
      if (!isTerminalRunStatus(run.status)) {
        this.runtimeBridge.stop(run.id);
      }
      runIds.push(run.id);
    }

    for (const runId of runIds) {
      this.runs.delete(runId);
    }
  }

  public dispose(): void {
    this.runtimeBridge.dispose();
    this.runs.clear();
  }

  private appendOutput(event: RuntimeStreamEvent): void {
    const run = this.runs.get(event.runId);
    if (!run || isTerminalRunStatus(run.status)) {
      return;
    }

    this.storeRun({
      ...run,
      tailLog: appendTailLog(run.tailLog, event.chunk)
    });
  }

  private completeRun(event: RuntimeExitEvent): void {
    const run = this.runs.get(event.runId);
    if (!run || isTerminalRunStatus(run.status)) {
      return;
    }

    const status: RunStatusInput = event.code === 0 ? 'completed' : 'failed';
    const tailLog = event.tail.length > 0 ? appendTailLog('', event.tail) : run.tailLog;
    const summary = buildSummary(tailLog);
    this.storeRun({
      ...run,
      status,
      tailLog,
      summary,
      completedAtMs: this.now()
    });
    this.pruneStoredRuns();
  }

  private pruneStoredRuns(): void {
    if (this.runs.size <= MAX_STORED_RUNS) {
      return;
    }

    const terminalRuns = [...this.runs.values()]
      .filter((run) => isTerminalRunStatus(run.status))
      .sort((left, right) => {
        const leftTimestamp = left.completedAtMs ?? left.createdAtMs;
        const rightTimestamp = right.completedAtMs ?? right.createdAtMs;
        return leftTimestamp - rightTimestamp;
      });

    for (const run of terminalRuns) {
      if (this.runs.size <= MAX_STORED_RUNS) {
        break;
      }
      this.runs.delete(run.id);
    }
  }

  private storeRun(run: RunRecord): void {
    this.runs.set(run.id, run);
    this.onRunUpdated?.(run);
  }
}

export const createRunsIpcHandlers = (deps: RunsIpcDependencies): RunsIpcHandlers => {
  const service = new InMemoryRunsService({
    assertWorkspaceExists: deps.assertWorkspaceExists,
    resolveWorkspaceRootDir: deps.resolveWorkspaceRootDir,
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
    },
    disposeWorkspaceRuns: (workspaceId: string): void => {
      service.disposeWorkspaceRuns(workspaceId);
    }
  };
};

const resolveIpcMain = (): RunsIpcMain => {
  const { ipcMain } = require('electron') as typeof import('electron');
  return ipcMain;
};

interface RegisteredRunsContext {
  dbFilePath: string;
  workspaceDbDir: string;
  enableCrashRecoveryOnOpen: boolean;
  recoveredWorkspaceIds: Set<string>;
  registry: RegistryRepository;
  service: InMemoryRunsService;
}

let registeredRunsContext: RegisteredRunsContext | null = null;

export interface RegisterRunsIpcHandlersOptions {
  dbFilePath: string;
  workspaceDbDir?: string;
  enableCrashRecoveryOnOpen?: boolean;
  ipcMain?: RunsIpcMain;
  runtimeBridge?: RuntimeBridge;
}

const toWorkspaceDbFileName = (workspaceId: string): string => {
  return workspaceId.replace(/[^a-zA-Z0-9_-]/g, '_');
};

const withWorkspaceRepository = <T,>(
  workspaceDbDir: string,
  workspaceId: string,
  action: (repository: ReturnType<typeof createWorkspaceRepository>) => T
): T => {
  const repository = createWorkspaceRepository({
    dbFilePath: path.join(workspaceDbDir, `${toWorkspaceDbFileName(workspaceId)}.db`)
  });
  try {
    return action(repository);
  } finally {
    repository.close();
  }
};

const assertRegisteredWorkspaceExists = (context: RegisteredRunsContext, workspaceId: string): string => {
  const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId);
  if (!context.registry.hasWorkspace(parsedWorkspaceId)) {
    throw new Error(`Workspace not found: ${parsedWorkspaceId}`);
  }
  return parsedWorkspaceId;
};

export const registerRunsIpcHandlers = (options: RegisterRunsIpcHandlersOptions): void => {
  const ipcMain = options.ipcMain ?? resolveIpcMain();
  const workspaceDbDir = options.workspaceDbDir ?? path.join(path.dirname(options.dbFilePath), 'workspaces');
  const enableCrashRecoveryOnOpen = options.enableCrashRecoveryOnOpen === true;

  if (
    !registeredRunsContext ||
    registeredRunsContext.dbFilePath !== options.dbFilePath ||
    registeredRunsContext.workspaceDbDir !== workspaceDbDir ||
    registeredRunsContext.enableCrashRecoveryOnOpen !== enableCrashRecoveryOnOpen
  ) {
    if (registeredRunsContext) {
      registeredRunsContext.service.dispose();
      registeredRunsContext.registry.close();
    }

    const registry = createRegistryRepository({ dbFilePath: options.dbFilePath });
    registeredRunsContext = {
      dbFilePath: options.dbFilePath,
      workspaceDbDir,
      enableCrashRecoveryOnOpen,
      recoveredWorkspaceIds: new Set<string>(),
      registry,
      service: new InMemoryRunsService({
        assertWorkspaceExists: (workspaceId: string) => {
          const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId);
          if (!registry.hasWorkspace(parsedWorkspaceId)) {
            throw new Error(`Workspace not found: ${parsedWorkspaceId}`);
          }
        },
        resolveWorkspaceRootDir: (workspaceId: string) => {
          const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId);
          return registry.getWorkspace(parsedWorkspaceId).rootDir;
        },
        runtimeBridge: options.runtimeBridge ?? createRuntimeBridge(),
        now: () => Date.now(),
        randomId: () => crypto.randomUUID(),
        launchEnv: process.env,
        onRunUpdated: (run: RunRecord) => {
          withWorkspaceRepository(workspaceDbDir, run.workspaceId, (repository) => {
            repository.saveRun(run);
          });
        }
      })
    };
  }

  const context = registeredRunsContext;
  if (!context) {
    throw new Error('Runs IPC context is unavailable');
  }

  const handlers = {
    startRun: async (_event: IpcMainInvokeEvent, input: RunStartInput) => {
      return {
        run: context.service.startRun(input)
      };
    },
    getRun: async (_event: IpcMainInvokeEvent, input: RunGetInput) => {
      const parsed = runGetSchema.parse(input);
      const parsedWorkspaceId = assertRegisteredWorkspaceExists(context, parsed.workspaceId);
      const persistedRun = withWorkspaceRepository(
        context.workspaceDbDir,
        parsedWorkspaceId,
        (repository) => repository.getRun(parsed.runId)
      );
      if (persistedRun && persistedRun.workspaceId === parsedWorkspaceId) {
        return {
          run: persistedRun
        };
      }
      return {
        run: context.service.getRun(input)
      };
    },
    listRuns: async (_event: IpcMainInvokeEvent, input: RunListInput) => {
      const parsed = runListSchema.parse(input);
      const parsedWorkspaceId = assertRegisteredWorkspaceExists(context, parsed.workspaceId);
      return {
        runs: withWorkspaceRepository(context.workspaceDbDir, parsedWorkspaceId, (repository) =>
          repository.listRunsByNode(parsed.nodeId).slice(0, MAX_LISTED_RUNS)
        )
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

export const disposeRunsForWorkspace = (workspaceId: string): void => {
  if (!registeredRunsContext) {
    return;
  }

  const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId);
  registeredRunsContext.service.disposeWorkspaceRuns(parsedWorkspaceId);
  registeredRunsContext.recoveredWorkspaceIds.delete(parsedWorkspaceId);
  withWorkspaceRepository(registeredRunsContext.workspaceDbDir, parsedWorkspaceId, (repository) => {
    repository.deleteWorkspaceRuns(parsedWorkspaceId);
    repository.deleteWorkspaceAuditLogs(parsedWorkspaceId);
  });
};

export const recoverRunsForWorkspace = (workspaceId: string): void => {
  if (!registeredRunsContext) {
    return;
  }
  if (!registeredRunsContext.enableCrashRecoveryOnOpen) {
    return;
  }

  const parsedWorkspaceId = assertRegisteredWorkspaceExists(registeredRunsContext, workspaceId);
  if (registeredRunsContext.recoveredWorkspaceIds.has(parsedWorkspaceId)) {
    return;
  }

  withWorkspaceRepository(registeredRunsContext.workspaceDbDir, parsedWorkspaceId, (repository) => {
    const recovery = createRecoveryService({
      workspaceId: parsedWorkspaceId,
      repository,
      auditLog: createAuditLog({
        workspaceId: parsedWorkspaceId,
        repository
      })
    });
    recovery.recoverWorkspace();
  });
  registeredRunsContext.recoveredWorkspaceIds.add(parsedWorkspaceId);
};

export const disposeRunsIpcHandlers = (): void => {
  if (!registeredRunsContext) {
    return;
  }
  registeredRunsContext.service.dispose();
  registeredRunsContext.registry.close();
  registeredRunsContext = null;
};
