import crypto from 'node:crypto';
import path from 'node:path';
import type { IpcMainInvokeEvent } from 'electron';
import {
  IPC_CHANNELS,
  type RunGetResponse,
  type RunInputResponse,
  type RunListResponse,
  type RunMutationResponse,
  type RunRecord,
  type RunStreamEvent
} from '../../shared/ipc/contracts';
import {
  runGetSchema,
  runInputSchema,
  runListSchema,
  runStreamChunkRangeSchema,
  runTailRangeSchema,
  runResizeSchema,
  runStartSchema,
  runStopSchema,
  workspaceIdSchema,
  type RunGetInput,
  type RunInputInput,
  type RunListInput,
  type RunResizeInput,
  type RunStartInput,
  type RunRuntimeInput,
  type RunStopInput,
  type RunStatusInput
} from '../../shared/ipc/schemas';
import { createAuditLog } from '../audit/audit-log';
import { createRegistryRepository, type RegistryRepository } from '../db/registry';
import { createWorkspaceRepository } from '../db/workspace';
import { createRecoveryService } from '../recovery/recovery-service';
import type { SkillPackRuntimeKind } from '../skills/skill-pack-manager';
import { createWorkspaceSkillInjectionManager } from '../skills/workspace-skill-injection-manager';
import {
  createRuntimeBridge,
  type RuntimeBridge,
  type RuntimeExitEvent,
  type RuntimeStreamEvent
} from '../runtime/runtime-bridge';

interface RunsIpcMain {
  handle: (channel: string, listener: (...args: any[]) => unknown) => void;
  removeHandler: (channel: string) => void;
  on: (channel: string, listener: (...args: any[]) => void) => void;
  removeListener: (channel: string, listener: (...args: any[]) => void) => void;
}

export interface RunsIpcHandlers {
  startRun: (_event: IpcMainInvokeEvent, input: RunStartInput) => Promise<RunMutationResponse>;
  getRun: (_event: IpcMainInvokeEvent, input: RunGetInput) => Promise<RunGetResponse>;
  listRuns: (_event: IpcMainInvokeEvent, input: RunListInput) => Promise<RunListResponse>;
  inputRun: (_event: IpcMainInvokeEvent, input: RunInputInput) => Promise<RunInputResponse>;
  stopRun: (_event: IpcMainInvokeEvent, input: RunStopInput) => Promise<RunMutationResponse>;
  subscribeStream: (runId: string, webContentsId: number) => void;
  unsubscribeStream: (runId: string, webContentsId: number) => void;
  resizeRun: (_event: IpcMainInvokeEvent, input: RunResizeInput) => Promise<void>;
  disposeWorkspaceRuns: (workspaceId: string) => void;
}

export interface RunsIpcDependencies {
  assertWorkspaceExists: (workspaceId: string) => void;
  resolveWorkspaceRootDir?: (workspaceId: string) => string;
  prepareRuntimeLaunch?: (input: PrepareRuntimeLaunchInput) => void;
  runtimeBridge?: RuntimeBridge;
  now?: () => number;
  randomId?: () => string;
  launchEnv?: NodeJS.ProcessEnv;
}

export interface PrepareRuntimeLaunchInput {
  workspaceId: string;
  workspaceRootDir?: string;
  runtime: RunRuntimeInput;
}

interface RunsServiceOptions {
  assertWorkspaceExists: (workspaceId: string) => void;
  resolveWorkspaceRootDir?: (workspaceId: string) => string;
  prepareRuntimeLaunch?: (input: PrepareRuntimeLaunchInput) => void;
  runtimeBridge: RuntimeBridge;
  now: () => number;
  randomId: () => string;
  launchEnv: NodeJS.ProcessEnv;
  onRunUpdated?: (run: RunRecord) => void;
}

const MAX_TAIL_LOG_LENGTH = 4096;
const MAX_STORED_RUNS = 200;
const MAX_LISTED_RUNS = 100;
const STOPPED_RUN_SUMMARY = 'Run stopped';
const RECOVERED_RUN_SUMMARY = 'Recovered after unclean shutdown';
const RECOVERY_EVENT_TYPE = 'run.recovered';

const MANAGED_RUNTIMES = new Set<SkillPackRuntimeKind>(['codex', 'claude', 'opencode']);

const isTerminalRunStatus = (status: RunStatusInput): boolean => {
  return status === 'completed' || status === 'failed' || status === 'stopped';
};

const isManagedRuntime = (runtime: RunRuntimeInput): runtime is SkillPackRuntimeKind => {
  return MANAGED_RUNTIMES.has(runtime as SkillPackRuntimeKind);
};

const appendTailLog = (tail: string, chunk: string): string => {
  const nextTail = `${tail}${chunk}`;
  if (nextTail.length <= MAX_TAIL_LOG_LENGTH) {
    return nextTail;
  }
  return nextTail.slice(nextTail.length - MAX_TAIL_LOG_LENGTH);
};

const createTailRange = (tailLog: string, tailEndOffset: number): Pick<RunRecord, 'tailStartOffset' | 'tailEndOffset'> => {
  return runTailRangeSchema.parse({
    tailStartOffset: Math.max(0, tailEndOffset - tailLog.length),
    tailEndOffset
  });
};

const appendRunOutput = (
  run: RunRecord,
  chunk: string
): {
  updatedRun: RunRecord;
  chunkStartOffset: number;
  chunkEndOffset: number;
} => {
  const chunkStartOffset = run.tailEndOffset;
  const chunkEndOffset = chunkStartOffset + chunk.length;
  const tailLog = appendTailLog(run.tailLog, chunk);

  return {
    updatedRun: {
      ...run,
      tailLog,
      ...createTailRange(tailLog, chunkEndOffset)
    },
    ...runStreamChunkRangeSchema.parse({
      chunkStartOffset,
      chunkEndOffset
    })
  };
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

const BRIDGE_USAGE_HINT = 'Use the OpenWeave bridge to inspect workspace graph nodes.';
const CLI_USAGE_HINT = 'Use the openweave CLI from the workspace root.';

const deriveExitStatus = (
  event: RuntimeExitEvent,
  stopRequested: boolean
): RunStatusInput => {
  if (stopRequested && (event.signal !== null || event.code !== 0)) {
    return 'stopped';
  }

  return event.code === 0 ? 'completed' : 'failed';
};

class InMemoryRunsService {
  private readonly runs = new Map<string, RunRecord>();

  private readonly stopIntents = new Set<string>();

  private readonly streamSubscribers = new Map<string, Set<number>>();

  private readonly assertWorkspaceExists: (workspaceId: string) => void;

  private readonly resolveWorkspaceRootDir?: (workspaceId: string) => string;

  private readonly prepareRuntimeLaunch?: (input: PrepareRuntimeLaunchInput) => void;

  private readonly runtimeBridge: RuntimeBridge;

  private readonly now: () => number;

  private readonly randomId: () => string;

  private readonly launchEnv: NodeJS.ProcessEnv;

  private readonly onRunUpdated?: (run: RunRecord) => void;

  constructor(options: RunsServiceOptions) {
    this.assertWorkspaceExists = options.assertWorkspaceExists;
    this.resolveWorkspaceRootDir = options.resolveWorkspaceRootDir;
    this.prepareRuntimeLaunch = options.prepareRuntimeLaunch;
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
      const streamEvent = this.appendOutput(event);
      if (streamEvent) {
        this.broadcastStream(streamEvent);
      }
    });

    this.runtimeBridge.on('stderr', (event) => {
      const streamEvent = this.appendOutput(event);
      if (streamEvent) {
        this.broadcastStream(streamEvent);
      }
    });

    this.runtimeBridge.on('exit', (event) => {
      this.completeRun(event);
    });
  }

  public startRun(input: RunStartInput): RunRecord {
    const parsed = runStartSchema.parse(input);
    this.assertWorkspaceExists(parsed.workspaceId);
    const workspaceRootDir = this.resolveWorkspaceRootDir?.(parsed.workspaceId);
    const effectiveCwd = parsed.workingDir || workspaceRootDir;

    const run: RunRecord = {
      id: this.randomId(),
      workspaceId: parsed.workspaceId,
      nodeId: parsed.nodeId,
      runtime: parsed.runtime,
      command: parsed.command,
      status: 'queued',
      summary: null,
      tailLog: '',
      tailStartOffset: 0,
      tailEndOffset: 0,
      createdAtMs: this.now(),
      startedAtMs: null,
      completedAtMs: null
    };

    this.storeRun(run);

    try {
      this.prepareRuntimeLaunch?.({
        workspaceId: run.workspaceId,
        workspaceRootDir,
        runtime: run.runtime
      });
      this.runtimeBridge.start({
        runId: run.id,
        runtime: run.runtime,
        command: run.command,
        cwd: effectiveCwd,
        env: this.launchEnv
      });
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      const failedTailLog = appendTailLog('', `${errorMessage}\n`);
      const failedRun: RunRecord = {
        ...run,
        status: 'failed',
        summary: errorMessage,
        tailLog: failedTailLog,
        ...createTailRange(failedTailLog, `${errorMessage}\n`.length),
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
    return this.requireRun(parsed.workspaceId, parsed.runId);
  }

  public hasRun(runId: string): boolean {
    return this.runs.has(runId);
  }

  public listRuns(input: RunListInput): RunRecord[] {
    const parsed = runListSchema.parse(input);
    this.assertWorkspaceExists(parsed.workspaceId);

    return [...this.runs.values()]
      .filter((run) => run.workspaceId === parsed.workspaceId && run.nodeId === parsed.nodeId)
      .sort((left, right) => right.createdAtMs - left.createdAtMs)
      .slice(0, MAX_LISTED_RUNS);
  }

  public inputRun(input: RunInputInput): RunInputResponse {
    const parsed = runInputSchema.parse(input);
    const run = this.requireRun(parsed.workspaceId, parsed.runId);

    if (
      isTerminalRunStatus(run.status) ||
      this.stopIntents.has(parsed.runId) ||
      !this.runtimeBridge.input(parsed.runId, parsed.input)
    ) {
      throw new Error(`Run not accepting input: ${parsed.runId}`);
    }

    return { ok: true };
  }

  public stopRun(input: RunStopInput): RunRecord {
    const parsed = runStopSchema.parse(input);
    const run = this.requireRun(parsed.workspaceId, parsed.runId);

    if (isTerminalRunStatus(run.status)) {
      return run;
    }
    if (this.stopIntents.has(parsed.runId)) {
      return run;
    }

    if (!this.runtimeBridge.stop(parsed.runId)) {
      throw new Error(`Run not active: ${parsed.runId}`);
    }

    this.stopIntents.add(parsed.runId);
    this.pruneStoredRuns();
    return run;
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
      this.stopIntents.delete(runId);
    }
  }

  public subscribeStream(runId: string, webContentsId: number): void {
    const set = this.streamSubscribers.get(runId) ?? new Set();
    set.add(webContentsId);
    this.streamSubscribers.set(runId, set);
  }

  public unsubscribeStream(runId: string, webContentsId: number): void {
    const set = this.streamSubscribers.get(runId);
    if (set) {
      set.delete(webContentsId);
      if (set.size === 0) {
        this.streamSubscribers.delete(runId);
      }
    }
  }

  public unsubscribeAllStreams(webContentsId: number): void {
    for (const [runId, set] of this.streamSubscribers) {
      set.delete(webContentsId);
      if (set.size === 0) {
        this.streamSubscribers.delete(runId);
      }
    }
  }

  private broadcastStream(event: RunStreamEvent): void {
    const { webContents } = require('electron');
    const subscribers = this.streamSubscribers.get(event.runId);
    if (!subscribers) return;
    for (const wcId of subscribers) {
      const wc = webContents.fromId(wcId);
      if (wc && !wc.isDestroyed()) {
        wc.send(IPC_CHANNELS.runStream, event);
      }
    }
  }

  public resizeRun(runId: string, cols: number, rows: number): void {
    const run = this.runs.get(runId);
    if (!run || isTerminalRunStatus(run.status)) {
      throw new Error(`Run not active: ${runId}`);
    }
    this.runtimeBridge.resize(runId, cols, rows);
  }

  public dispose(): void {
    this.runtimeBridge.dispose();
    this.runs.clear();
    this.streamSubscribers.clear();
  }

  private appendOutput(event: RuntimeStreamEvent): RunStreamEvent | null {
    const run = this.runs.get(event.runId);
    if (!run || isTerminalRunStatus(run.status)) {
      return null;
    }

    const { updatedRun, chunkStartOffset, chunkEndOffset } = appendRunOutput(run, event.chunk);
    this.storeRun(updatedRun);
    return {
      runId: event.runId,
      chunk: event.chunk,
      chunkStartOffset,
      chunkEndOffset
    };
  }

  private completeRun(event: RuntimeExitEvent): void {
    const run = this.runs.get(event.runId);
    if (!run || isTerminalRunStatus(run.status)) {
      return;
    }

    const stopRequested = this.stopIntents.delete(event.runId);
    const status = deriveExitStatus(event, stopRequested);
    const tailLog = event.tail.length > 0 ? appendTailLog('', event.tail) : run.tailLog;
    const tailEndOffset =
      event.tail.length > 0 ? Math.max(run.tailEndOffset, event.tail.length) : run.tailEndOffset;
    const summary = status === 'stopped' ? STOPPED_RUN_SUMMARY : buildSummary(tailLog);
    this.storeRun({
      ...run,
      status,
      tailLog,
      ...createTailRange(tailLog, tailEndOffset),
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

  private requireRun(workspaceId: string, runId: string): RunRecord {
    const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId);
    this.assertWorkspaceExists(parsedWorkspaceId);

    const run = this.runs.get(runId);
    if (!run || run.workspaceId !== parsedWorkspaceId) {
      throw new Error(`Run not found: ${runId}`);
    }
    return run;
  }
}

export const createRunsIpcHandlers = (deps: RunsIpcDependencies): RunsIpcHandlers => {
  const service = new InMemoryRunsService({
    assertWorkspaceExists: deps.assertWorkspaceExists,
    resolveWorkspaceRootDir: deps.resolveWorkspaceRootDir,
    prepareRuntimeLaunch: deps.prepareRuntimeLaunch,
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
    inputRun: async (_event: IpcMainInvokeEvent, input: RunInputInput) => {
      return service.inputRun(input);
    },
    stopRun: async (_event: IpcMainInvokeEvent, input: RunStopInput) => {
      return {
        run: service.stopRun(input)
      };
    },
    subscribeStream: (runId: string, webContentsId: number): void => {
      service.subscribeStream(runId, webContentsId);
    },
    unsubscribeStream: (runId: string, webContentsId: number): void => {
      service.unsubscribeStream(runId, webContentsId);
    },
    resizeRun: async (_event: IpcMainInvokeEvent, input: RunResizeInput): Promise<void> => {
      service.resizeRun(input.runId, input.cols, input.rows);
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
  workspaceRootDirs: Map<string, string>;
  registry: RegistryRepository;
  service: InMemoryRunsService;
}

const reconcilePersistedOrphanRuns = (
  context: RegisteredRunsContext,
  workspaceId: string,
  repository: ReturnType<typeof createWorkspaceRepository>
): Map<string, RunRecord> => {
  const existingRecoveryAuditRunIds = new Set(
    repository
      .listAuditLogs(1000)
      .filter((audit) => audit.eventType === RECOVERY_EVENT_TYPE && typeof audit.runId === 'string')
      .map((audit) => audit.runId as string)
  );
  const reconciledRuns = new Map<string, RunRecord>();

  for (const run of repository.listRuns()) {
    if (isTerminalRunStatus(run.status) || context.service.hasRun(run.id)) {
      continue;
    }

    const reconciledRun: RunRecord = {
      ...run,
      status: 'failed',
      summary: RECOVERED_RUN_SUMMARY,
      completedAtMs: run.completedAtMs ?? Date.now()
    };
    repository.saveRun(reconciledRun);
    reconciledRuns.set(reconciledRun.id, reconciledRun);

    if (!existingRecoveryAuditRunIds.has(reconciledRun.id)) {
      createAuditLog({
        workspaceId,
        repository
      }).persist({
        eventType: RECOVERY_EVENT_TYPE,
        runId: reconciledRun.id,
        status: 'success',
        message: RECOVERED_RUN_SUMMARY
      });
      existingRecoveryAuditRunIds.add(reconciledRun.id);
    }
  }

  return reconciledRuns;
};

let registeredRunsContext: RegisteredRunsContext | null = null;

export interface RegisterRunsIpcHandlersOptions {
  dbFilePath: string;
  workspaceDbDir?: string;
  enableCrashRecoveryOnOpen?: boolean;
  ipcMain?: RunsIpcMain;
  runtimeBridge?: RuntimeBridge;
  launchEnv?: NodeJS.ProcessEnv;
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

const prepareRegisteredRuntimeLaunch = (
  workspaceDbDir: string,
  input: PrepareRuntimeLaunchInput
): void => {
  const workspaceRootDir = input.workspaceRootDir;
  const runtimeKind = isManagedRuntime(input.runtime) ? input.runtime : null;
  if (!workspaceRootDir || runtimeKind === null) {
    return;
  }

  withWorkspaceRepository(workspaceDbDir, input.workspaceId, (repository) => {
    createWorkspaceSkillInjectionManager({
      workspaceId: input.workspaceId,
      workspaceRoot: workspaceRootDir,
      repository
    }).prepareForRuntimeLaunch({
      runtimeKind,
      bridgeUsageHint: BRIDGE_USAGE_HINT,
      cliUsageHint: CLI_USAGE_HINT
    });
  });
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
    const workspaceRootDirs = new Map(
      registry.listWorkspaces().map((workspace) => [workspace.id, workspace.rootDir] as const)
    );
    registeredRunsContext = {
      dbFilePath: options.dbFilePath,
      workspaceDbDir,
      enableCrashRecoveryOnOpen,
      recoveredWorkspaceIds: new Set<string>(),
      workspaceRootDirs,
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
          const workspaceRootDir = registry.getWorkspace(parsedWorkspaceId).rootDir;
          registeredRunsContext?.workspaceRootDirs.set(parsedWorkspaceId, workspaceRootDir);
          return workspaceRootDir;
        },
        prepareRuntimeLaunch: (input: PrepareRuntimeLaunchInput) => {
          prepareRegisteredRuntimeLaunch(workspaceDbDir, input);
        },
        runtimeBridge: options.runtimeBridge ?? createRuntimeBridge(),
        now: () => Date.now(),
        randomId: () => crypto.randomUUID(),
        launchEnv: options.launchEnv ?? process.env,
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
        (repository) => {
          const reconciledRuns = reconcilePersistedOrphanRuns(context, parsedWorkspaceId, repository);
          return reconciledRuns.get(parsed.runId) ?? repository.getRun(parsed.runId);
        }
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
        runs: withWorkspaceRepository(context.workspaceDbDir, parsedWorkspaceId, (repository) => {
          const reconciledRuns = reconcilePersistedOrphanRuns(context, parsedWorkspaceId, repository);
          return repository
            .listRunsByNode(parsed.nodeId)
            .map((run) => reconciledRuns.get(run.id) ?? run)
            .slice(0, MAX_LISTED_RUNS);
        })
      };
    },
    inputRun: async (_event: IpcMainInvokeEvent, input: RunInputInput) => {
      const parsed = runInputSchema.parse(input);
      assertRegisteredWorkspaceExists(context, parsed.workspaceId);
      return context.service.inputRun(parsed);
    },
    stopRun: async (_event: IpcMainInvokeEvent, input: RunStopInput) => {
      const parsed = runStopSchema.parse(input);
      const parsedWorkspaceId = assertRegisteredWorkspaceExists(context, parsed.workspaceId);
      const persistedRun = withWorkspaceRepository(context.workspaceDbDir, parsedWorkspaceId, (repository) => {
        const reconciledRuns = reconcilePersistedOrphanRuns(context, parsedWorkspaceId, repository);
        return reconciledRuns.get(parsed.runId) ?? repository.getRun(parsed.runId);
      });

      if (persistedRun && isTerminalRunStatus(persistedRun.status) && !context.service.hasRun(parsed.runId)) {
        return {
          run: persistedRun
        };
      }

      return {
        run: context.service.stopRun(parsed)
      };
    }
  };

  ipcMain.removeHandler(IPC_CHANNELS.runStart);
  ipcMain.removeHandler(IPC_CHANNELS.runGet);
  ipcMain.removeHandler(IPC_CHANNELS.runList);
  ipcMain.removeHandler(IPC_CHANNELS.runInput);
  ipcMain.removeHandler(IPC_CHANNELS.runStop);
  ipcMain.removeHandler(IPC_CHANNELS.runStreamSubscribe);
  ipcMain.removeHandler(IPC_CHANNELS.runStreamUnsubscribe);
  ipcMain.removeHandler(IPC_CHANNELS.runResize);

  ipcMain.handle(IPC_CHANNELS.runStart, handlers.startRun);
  ipcMain.handle(IPC_CHANNELS.runGet, handlers.getRun);
  ipcMain.handle(IPC_CHANNELS.runList, handlers.listRuns);
  ipcMain.handle(IPC_CHANNELS.runInput, handlers.inputRun);
  ipcMain.handle(IPC_CHANNELS.runStop, handlers.stopRun);

  ipcMain.on(IPC_CHANNELS.runStreamSubscribe, (_event, { runId }) => {
    const wcId = (_event as any).sender.id as number;
    context.service.subscribeStream(runId, wcId);
  });

  ipcMain.on(IPC_CHANNELS.runStreamUnsubscribe, (_event, { runId }) => {
    const wcId = (_event as any).sender.id as number;
    context.service.unsubscribeStream(runId, wcId);
  });

  ipcMain.handle(IPC_CHANNELS.runResize, async (_event, input) => {
    const parsed = runResizeSchema.parse(input);
    context.service.resizeRun(parsed.runId, parsed.cols, parsed.rows);
  });
};

export const disposeRunsForWorkspace = (workspaceId: string): void => {
  if (!registeredRunsContext) {
    return;
  }

  const parsedWorkspaceId = workspaceIdSchema.parse(workspaceId);
  registeredRunsContext.service.disposeWorkspaceRuns(parsedWorkspaceId);
  registeredRunsContext.recoveredWorkspaceIds.delete(parsedWorkspaceId);
  const workspaceRootDir =
    registeredRunsContext.workspaceRootDirs.get(parsedWorkspaceId) ??
    (registeredRunsContext.registry.hasWorkspace(parsedWorkspaceId)
      ? registeredRunsContext.registry.getWorkspace(parsedWorkspaceId).rootDir
      : undefined);
  withWorkspaceRepository(registeredRunsContext.workspaceDbDir, parsedWorkspaceId, (repository) => {
    if (workspaceRootDir) {
      const manager = createWorkspaceSkillInjectionManager({
        workspaceId: parsedWorkspaceId,
        workspaceRoot: workspaceRootDir,
        repository
      });
      for (const record of repository.listSkillInjections()) {
        manager.cleanupRuntimeInjection(record.runtimeKind);
      }
    }
    repository.deleteWorkspaceRuns(parsedWorkspaceId);
    repository.deleteWorkspaceAuditLogs(parsedWorkspaceId);
  });
  registeredRunsContext.workspaceRootDirs.delete(parsedWorkspaceId);
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
