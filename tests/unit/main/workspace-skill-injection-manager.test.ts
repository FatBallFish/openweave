import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  WorkspaceSkillInjectionRecord,
  WorkspaceSkillInjectionStore
} from '../../../src/main/db/workspace';
import { createWorkspaceSkillInjectionManager } from '../../../src/main/skills/workspace-skill-injection-manager';

const BRIDGE_USAGE_HINT = 'Use the OpenWeave bridge to inspect workspace graph nodes.';
const CLI_USAGE_HINT = 'Use the openweave CLI from the workspace root.';

let testDir = '';

const createWorkspaceRoot = (): string => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-workspace-skill-injection-unit-'));
  const workspaceRoot = path.join(testDir, 'workspace');
  fs.mkdirSync(workspaceRoot, { recursive: true });
  return workspaceRoot;
};

const createInMemoryInjectionStore = (): WorkspaceSkillInjectionStore & {
  records: Map<string, WorkspaceSkillInjectionRecord>;
} => {
  const records = new Map<string, WorkspaceSkillInjectionRecord>();

  return {
    records,
    getSkillInjection: (runtimeKind) => records.get(runtimeKind) ?? null,
    listSkillInjections: () => [...records.values()].sort((left, right) =>
      left.runtimeKind.localeCompare(right.runtimeKind)
    ),
    saveSkillInjection: (input) => {
      const record: WorkspaceSkillInjectionRecord = {
        workspaceId: input.workspaceId,
        runtimeKind: input.runtimeKind,
        checksum: input.checksum,
        managedFiles: input.managedFiles.map((file) => ({ ...file })),
        createdAtMs: input.createdAtMs,
        updatedAtMs: input.updatedAtMs
      };
      records.set(record.runtimeKind, record);
      return record;
    },
    deleteSkillInjection: (runtimeKind) => {
      records.delete(runtimeKind);
    }
  };
};

afterEach(() => {
  if (testDir !== '') {
    fs.rmSync(testDir, { recursive: true, force: true });
    testDir = '';
  }
});

describe('workspace skill injection manager', () => {
  it('skips workspace rewrites when the stored checksum is already current', () => {
    const workspaceRoot = createWorkspaceRoot();
    const repository = createInMemoryInjectionStore();
    let nowValue = 100;
    const manager = createWorkspaceSkillInjectionManager({
      workspaceId: 'workspace-unit-noop',
      workspaceRoot,
      repository,
      now: () => nowValue
    });

    const firstResult = manager.prepareForRuntimeLaunch({
      runtimeKind: 'codex',
      bridgeUsageHint: BRIDGE_USAGE_HINT,
      cliUsageHint: CLI_USAGE_HINT
    });

    expect(firstResult.status).toBe('created');
    expect(repository.getSkillInjection('codex')?.updatedAtMs).toBe(100);

    nowValue = 200;
    const originalWriteFileSync = fs.writeFileSync;
    const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(
      ((...args: Parameters<typeof fs.writeFileSync>) => {
        const filePath = args[0];
        if (typeof filePath === 'string' && filePath.startsWith(workspaceRoot)) {
          throw new Error(`workspace root should not be rewritten: ${filePath}`);
        }
        return originalWriteFileSync(...args);
      }) as typeof fs.writeFileSync
    );

    try {
      const secondResult = manager.prepareForRuntimeLaunch({
        runtimeKind: 'codex',
        bridgeUsageHint: BRIDGE_USAGE_HINT,
        cliUsageHint: CLI_USAGE_HINT
      });

      expect(secondResult.status).toBe('unchanged');
      expect(secondResult.writtenFiles).toEqual([]);
      expect(repository.getSkillInjection('codex')?.updatedAtMs).toBe(100);
    } finally {
      writeFileSyncSpy.mockRestore();
    }
  });

  it('treats a runtime switch as stale injection, updates files, and drops prior runtime ownership', () => {
    const workspaceRoot = createWorkspaceRoot();
    const repository = createInMemoryInjectionStore();
    let nowValue = 100;
    const manager = createWorkspaceSkillInjectionManager({
      workspaceId: 'workspace-unit-runtime-switch',
      workspaceRoot,
      repository,
      now: () => nowValue
    });

    manager.prepareForRuntimeLaunch({
      runtimeKind: 'codex',
      bridgeUsageHint: BRIDGE_USAGE_HINT,
      cliUsageHint: CLI_USAGE_HINT
    });

    expect(fs.existsSync(path.join(workspaceRoot, 'AGENTS.md'))).toBe(true);
    expect(fs.existsSync(path.join(workspaceRoot, '.agents', 'skills', 'openweave-workspace.md'))).toBe(true);

    nowValue = 200;
    const result = manager.prepareForRuntimeLaunch({
      runtimeKind: 'claude',
      bridgeUsageHint: `${BRIDGE_USAGE_HINT} (Claude)`,
      cliUsageHint: CLI_USAGE_HINT
    });

    expect(result.status).toBe('created');
    expect(fs.existsSync(path.join(workspaceRoot, 'AGENTS.md'))).toBe(false);
    expect(fs.existsSync(path.join(workspaceRoot, '.agents', 'skills', 'openweave-workspace.md'))).toBe(false);
    expect(fs.existsSync(path.join(workspaceRoot, '.claude', 'skills', 'openweave-workspace.md'))).toBe(true);
    expect(repository.getSkillInjection('codex')).toBeNull();
    expect(repository.listSkillInjections().map((record) => record.runtimeKind)).toEqual(['claude']);
    expect(repository.getSkillInjection('claude')?.updatedAtMs).toBe(200);
  });
});
