import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  type WorkspaceSkillInjectionRecord,
  type WorkspaceSkillInjectionRuntimeKind,
  type WorkspaceSkillInjectionStore,
  type WorkspaceSkillManagedFileRecord
} from '../db/workspace';
import {
  createSkillPackManager,
  type GeneratedSkillPackFile,
  type SkillPackRuntimeKind
} from './skill-pack-manager';

export interface PrepareWorkspaceSkillInjectionInput {
  runtimeKind: SkillPackRuntimeKind;
  bridgeUsageHint: string;
  cliUsageHint: string;
}

export interface PrepareWorkspaceSkillInjectionResult {
  status: 'created' | 'updated' | 'unchanged';
  checksum: string;
  writtenFiles: string[];
}

export interface CleanupWorkspaceSkillInjectionResult {
  removedFiles: string[];
}

export interface CreateWorkspaceSkillInjectionManagerOptions {
  workspaceId: string;
  workspaceRoot: string;
  repository: WorkspaceSkillInjectionStore;
  now?: () => number;
}

interface GeneratedManagedFile extends WorkspaceSkillManagedFileRecord {
  absolutePath: string;
  content: string;
}

interface GeneratedSnapshot {
  checksum: string;
  managedFiles: GeneratedManagedFile[];
}

interface ManagedFileRollbackEntry {
  absolutePath: string;
  previousContent: Buffer | null;
}

export interface WorkspaceSkillInjectionManager {
  prepareForRuntimeLaunch: (
    input: PrepareWorkspaceSkillInjectionInput
  ) => PrepareWorkspaceSkillInjectionResult;
  cleanupRuntimeInjection: (
    runtimeKind: WorkspaceSkillInjectionRuntimeKind
  ) => CleanupWorkspaceSkillInjectionResult;
}

const hashContent = (value: string | Buffer): string => {
  return createHash('sha256').update(value).digest('hex');
};

const createManagedSymlinkError = (workspaceRoot: string, absolutePath: string): Error => {
  const relativePath = path.relative(workspaceRoot, absolutePath) || '.';
  return new Error(`Managed workspace skill path cannot traverse a symlink: ${relativePath}`);
};

const createManagedFileModifiedError = (relativePath: string): Error => {
  return new Error(`Managed workspace skill file was modified by the user: ${relativePath}`);
};

const assertManagedPathIsSafe = (workspaceRoot: string, absolutePath: string): void => {
  const relativePath = path.relative(workspaceRoot, absolutePath);
  if (
    relativePath.startsWith('..') ||
    path.isAbsolute(relativePath) ||
    relativePath.split(path.sep).includes('..')
  ) {
    throw createManagedSymlinkError(workspaceRoot, absolutePath);
  }

  let currentPath = workspaceRoot;
  for (const segment of relativePath.split(path.sep).filter((value) => value.length > 0)) {
    currentPath = path.join(currentPath, segment);
    try {
      if (fs.lstatSync(currentPath).isSymbolicLink()) {
        throw createManagedSymlinkError(workspaceRoot, currentPath);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw error;
    }
  }
};

const removeEmptyParentDirectories = (workspaceRoot: string, targetPath: string): void => {
  let currentPath = path.dirname(targetPath);

  while (currentPath.startsWith(workspaceRoot) && currentPath !== workspaceRoot) {
    if (!fs.existsSync(currentPath)) {
      currentPath = path.dirname(currentPath);
      continue;
    }

    if (fs.readdirSync(currentPath).length > 0) {
      break;
    }

    fs.rmdirSync(currentPath);
    currentPath = path.dirname(currentPath);
  }
};

const readManagedFileSnapshot = (workspaceRoot: string, files: GeneratedSkillPackFile[]): GeneratedSnapshot => {
  const managedFiles = files
    .map((file) => {
      const content = fs.readFileSync(file.absolutePath, 'utf8');
      return {
        relativePath: file.relativePath,
        absolutePath: path.join(workspaceRoot, file.relativePath),
        content,
        contentChecksum: hashContent(content)
      };
    })
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  const checksum = hashContent(
    JSON.stringify(
      managedFiles.map((file) => ({
        relativePath: file.relativePath,
        contentChecksum: file.contentChecksum
      }))
    )
  );

  return {
    checksum,
    managedFiles
  };
};

const createGeneratedSnapshot = (
  workspaceId: string,
  workspaceRoot: string,
  input: PrepareWorkspaceSkillInjectionInput
): GeneratedSnapshot => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-workspace-skill-pack-'));

  try {
    const generated = createSkillPackManager().generateSkillPack({
      workspaceId,
      workspaceRoot: tempDir,
      templateWorkspaceRoot: workspaceRoot,
      runtimeKind: input.runtimeKind,
      bridgeUsageHint: input.bridgeUsageHint,
      cliUsageHint: input.cliUsageHint
    });

    return readManagedFileSnapshot(workspaceRoot, generated.files);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const recordMatchesWorkspace = (
  workspaceRoot: string,
  record: WorkspaceSkillInjectionRecord
): boolean => {
  return record.managedFiles.every((file) => {
    const absolutePath = path.join(workspaceRoot, file.relativePath);
    assertManagedPathIsSafe(workspaceRoot, absolutePath);
    if (!fs.existsSync(absolutePath)) {
      return false;
    }

    const stats = fs.statSync(absolutePath);
    if (!stats.isFile()) {
      return false;
    }

    return hashContent(fs.readFileSync(absolutePath)) === file.contentChecksum;
  });
};

const removeManagedFiles = (
  workspaceRoot: string,
  record: WorkspaceSkillInjectionRecord
): string[] => {
  const removedFiles: string[] = [];
  const sortedFiles = [...record.managedFiles].sort((left, right) =>
    right.relativePath.localeCompare(left.relativePath)
  );

  for (const file of sortedFiles) {
    const absolutePath = path.join(workspaceRoot, file.relativePath);
    assertManagedPathIsSafe(workspaceRoot, absolutePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    const stats = fs.statSync(absolutePath);
    if (!stats.isFile()) {
      continue;
    }

    const currentChecksum = hashContent(fs.readFileSync(absolutePath));
    if (currentChecksum !== file.contentChecksum) {
      continue;
    }

    fs.rmSync(absolutePath, { force: true });
    removeEmptyParentDirectories(workspaceRoot, absolutePath);
    removedFiles.push(file.relativePath);
  }

  return removedFiles.sort((left, right) => left.localeCompare(right));
};

const rollbackManagedFileWrites = (
  workspaceRoot: string,
  rollbackEntries: ManagedFileRollbackEntry[]
): void => {
  for (const rollbackEntry of [...rollbackEntries].reverse()) {
    if (rollbackEntry.previousContent === null) {
      fs.rmSync(rollbackEntry.absolutePath, { force: true });
      removeEmptyParentDirectories(workspaceRoot, rollbackEntry.absolutePath);
      continue;
    }

    fs.mkdirSync(path.dirname(rollbackEntry.absolutePath), { recursive: true });
    fs.writeFileSync(rollbackEntry.absolutePath, rollbackEntry.previousContent);
  }
};

const writeManagedFiles = (workspaceRoot: string, snapshot: GeneratedSnapshot): string[] => {
  const writtenFiles: string[] = [];
  const rollbackEntries: ManagedFileRollbackEntry[] = [];

  for (const file of snapshot.managedFiles) {
    const absolutePath = path.join(workspaceRoot, file.relativePath);
    assertManagedPathIsSafe(workspaceRoot, absolutePath);
    const previousContent =
      fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()
        ? fs.readFileSync(absolutePath)
        : null;
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      const currentChecksum = hashContent(previousContent ?? '');
      if (currentChecksum === file.contentChecksum) {
        continue;
      }
    }

    rollbackEntries.push({
      absolutePath,
      previousContent
    });

    try {
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, file.content, 'utf8');
      writtenFiles.push(file.relativePath);
    } catch (error) {
      rollbackManagedFileWrites(workspaceRoot, rollbackEntries);
      throw error;
    }
  }

  return writtenFiles.sort((left, right) => left.localeCompare(right));
};

const removeStaleManagedFiles = (
  workspaceRoot: string,
  currentRecord: WorkspaceSkillInjectionRecord,
  snapshot: GeneratedSnapshot
): string[] => {
  const nextManagedPaths = new Set(snapshot.managedFiles.map((file) => file.relativePath));

  return removeManagedFiles(workspaceRoot, {
    ...currentRecord,
    managedFiles: currentRecord.managedFiles.filter((file) => !nextManagedPaths.has(file.relativePath))
  });
};

const buildPreviousManagedChecksumMap = (
  records: WorkspaceSkillInjectionRecord[]
): Map<string, Set<string>> => {
  const checksumsByPath = new Map<string, Set<string>>();

  for (const record of records) {
    for (const file of record.managedFiles) {
      const existingChecksums = checksumsByPath.get(file.relativePath) ?? new Set<string>();
      existingChecksums.add(file.contentChecksum);
      checksumsByPath.set(file.relativePath, existingChecksums);
    }
  }

  return checksumsByPath;
};

const assertManagedTargetsNotUserModified = (
  workspaceRoot: string,
  snapshot: GeneratedSnapshot,
  existingRecords: WorkspaceSkillInjectionRecord[]
): void => {
  const previousChecksumsByPath = buildPreviousManagedChecksumMap(existingRecords);

  for (const file of snapshot.managedFiles) {
    const previousChecksums = previousChecksumsByPath.get(file.relativePath);
    if (!previousChecksums || previousChecksums.size === 0) {
      continue;
    }

    const absolutePath = path.join(workspaceRoot, file.relativePath);
    assertManagedPathIsSafe(workspaceRoot, absolutePath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      continue;
    }

    const currentChecksum = hashContent(fs.readFileSync(absolutePath));
    if (!previousChecksums.has(currentChecksum) && currentChecksum !== file.contentChecksum) {
      throw createManagedFileModifiedError(file.relativePath);
    }
  }
};

const assertStaleManagedTargetsNotUserModified = (
  workspaceRoot: string,
  snapshot: GeneratedSnapshot,
  existingRecords: WorkspaceSkillInjectionRecord[]
): void => {
  const nextManagedPaths = new Set(snapshot.managedFiles.map((file) => file.relativePath));

  for (const record of existingRecords) {
    for (const file of record.managedFiles) {
      if (nextManagedPaths.has(file.relativePath)) {
        continue;
      }

      const absolutePath = path.join(workspaceRoot, file.relativePath);
      assertManagedPathIsSafe(workspaceRoot, absolutePath);
      if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
        continue;
      }

      const currentChecksum = hashContent(fs.readFileSync(absolutePath));
      if (currentChecksum !== file.contentChecksum) {
        throw createManagedFileModifiedError(file.relativePath);
      }
    }
  }
};

const toManagedFileManifest = (snapshot: GeneratedSnapshot): WorkspaceSkillManagedFileRecord[] => {
  return snapshot.managedFiles.map((file) => ({
    relativePath: file.relativePath,
    contentChecksum: file.contentChecksum
  }));
};

export const createWorkspaceSkillInjectionManager = (
  options: CreateWorkspaceSkillInjectionManagerOptions
): WorkspaceSkillInjectionManager => {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const now = options.now ?? (() => Date.now());

  const cleanupRecord = (record: WorkspaceSkillInjectionRecord): string[] => {
    const removedFiles = removeManagedFiles(workspaceRoot, record);
    options.repository.deleteSkillInjection(record.runtimeKind);
    return removedFiles;
  };

  return {
    prepareForRuntimeLaunch: (
      input: PrepareWorkspaceSkillInjectionInput
    ): PrepareWorkspaceSkillInjectionResult => {
      const snapshot = createGeneratedSnapshot(options.workspaceId, workspaceRoot, input);
      const currentRecord = options.repository.getSkillInjection(input.runtimeKind);
      const runtimeKind = input.runtimeKind as WorkspaceSkillInjectionRuntimeKind;

      const otherRuntimeRecords = options.repository
        .listSkillInjections()
        .filter((record) => record.runtimeKind !== runtimeKind);
      const existingManagedRecords = [
        ...(currentRecord ? [currentRecord] : []),
        ...otherRuntimeRecords
      ];

      if (
        currentRecord &&
        currentRecord.checksum === snapshot.checksum &&
        recordMatchesWorkspace(workspaceRoot, currentRecord)
      ) {
        return {
          status: 'unchanged',
          checksum: currentRecord.checksum,
          writtenFiles: []
        };
      }

      assertManagedTargetsNotUserModified(workspaceRoot, snapshot, existingManagedRecords);
      assertStaleManagedTargetsNotUserModified(workspaceRoot, snapshot, existingManagedRecords);
      const writtenFiles = writeManagedFiles(workspaceRoot, snapshot);

      for (const record of otherRuntimeRecords) {
        cleanupRecord(record);
      }

      if (currentRecord) {
        removeStaleManagedFiles(workspaceRoot, currentRecord, snapshot);
      }

      const timestamp = now();
      const createdAtMs = currentRecord?.createdAtMs ?? timestamp;

      options.repository.saveSkillInjection({
        workspaceId: options.workspaceId,
        runtimeKind,
        checksum: snapshot.checksum,
        managedFiles: toManagedFileManifest(snapshot),
        createdAtMs,
        updatedAtMs: timestamp
      });

      return {
        status: currentRecord ? 'updated' : 'created',
        checksum: snapshot.checksum,
        writtenFiles
      };
    },
    cleanupRuntimeInjection: (
      runtimeKind: WorkspaceSkillInjectionRuntimeKind
    ): CleanupWorkspaceSkillInjectionResult => {
      const record = options.repository.getSkillInjection(runtimeKind);
      if (!record) {
        return {
          removedFiles: []
        };
      }

      return {
        removedFiles: cleanupRecord(record)
      };
    }
  };
};
