import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createWorkspaceRepository, type WorkspaceRepository } from '../../../src/main/db/workspace';
import { createWorkspaceSkillInjectionManager } from '../../../src/main/skills/workspace-skill-injection-manager';

const BRIDGE_USAGE_HINT = 'Use the OpenWeave bridge to inspect workspace graph nodes.';
const CLI_USAGE_HINT = 'Use the openweave CLI from the workspace root.';

let testDir = '';
let repository: WorkspaceRepository | null = null;

const createTestContext = (): { workspaceRoot: string; dbFilePath: string } => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-workspace-skill-injection-integration-'));
  const workspaceRoot = path.join(testDir, 'workspace');
  fs.mkdirSync(workspaceRoot, { recursive: true });
  return {
    workspaceRoot,
    dbFilePath: path.join(testDir, 'workspace.db')
  };
};

afterEach(() => {
  repository?.close();
  repository = null;
  if (testDir !== '') {
    fs.rmSync(testDir, { recursive: true, force: true });
    testDir = '';
  }
});

describe('workspace skill injection manager integration', () => {
  it('writes managed files into the workspace root and persists the manifest in the workspace db', () => {
    const context = createTestContext();
    repository = createWorkspaceRepository({
      dbFilePath: context.dbFilePath,
      now: () => 123
    });
    const manager = createWorkspaceSkillInjectionManager({
      workspaceId: 'workspace-integration-write',
      workspaceRoot: context.workspaceRoot,
      repository,
      now: () => 123
    });

    const result = manager.prepareForRuntimeLaunch({
      runtimeKind: 'codex',
      bridgeUsageHint: BRIDGE_USAGE_HINT,
      cliUsageHint: CLI_USAGE_HINT
    });

    expect(result.status).toBe('created');
    expect(result.writtenFiles).toEqual(['.agents/skills/openweave-workspace.md', 'AGENTS.md']);
    expect(fs.readFileSync(path.join(context.workspaceRoot, 'AGENTS.md'), 'utf8')).toContain('runtime: codex');
    expect(
      fs.readFileSync(path.join(context.workspaceRoot, '.agents', 'skills', 'openweave-workspace.md'), 'utf8')
    ).toContain(BRIDGE_USAGE_HINT);

    repository.close();
    repository = createWorkspaceRepository({
      dbFilePath: context.dbFilePath
    });

    const persisted = repository.getSkillInjection('codex');
    expect(persisted).not.toBeNull();
    expect(persisted?.workspaceId).toBe('workspace-integration-write');
    expect(persisted?.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(persisted?.managedFiles.map((file) => file.relativePath)).toEqual([
      '.agents/skills/openweave-workspace.md',
      'AGENTS.md'
    ]);
  });

  it('cleanup removes only OpenWeave-managed files and leaves user-owned files alone', () => {
    const context = createTestContext();
    repository = createWorkspaceRepository({
      dbFilePath: context.dbFilePath,
      now: () => 500
    });
    const manager = createWorkspaceSkillInjectionManager({
      workspaceId: 'workspace-integration-cleanup',
      workspaceRoot: context.workspaceRoot,
      repository,
      now: () => 500
    });

    manager.prepareForRuntimeLaunch({
      runtimeKind: 'codex',
      bridgeUsageHint: BRIDGE_USAGE_HINT,
      cliUsageHint: CLI_USAGE_HINT
    });

    fs.writeFileSync(path.join(context.workspaceRoot, 'AGENTS.md'), '# user override\n', 'utf8');
    fs.writeFileSync(path.join(context.workspaceRoot, '.agents', 'skills', 'custom.md'), '# keep me\n', 'utf8');

    const cleanup = manager.cleanupRuntimeInjection('codex');

    expect(cleanup.removedFiles).toEqual(['.agents/skills/openweave-workspace.md']);
    expect(fs.existsSync(path.join(context.workspaceRoot, 'AGENTS.md'))).toBe(true);
    expect(fs.readFileSync(path.join(context.workspaceRoot, 'AGENTS.md'), 'utf8')).toBe('# user override\n');
    expect(fs.existsSync(path.join(context.workspaceRoot, '.agents', 'skills', 'custom.md'))).toBe(true);
    expect(repository.getSkillInjection('codex')).toBeNull();
  });

  it('rejects a managed write when a managed ancestor directory is a symlink', () => {
    const context = createTestContext();
    const outsideDir = path.join(testDir, 'outside-agents');
    fs.mkdirSync(outsideDir, { recursive: true });
    fs.symlinkSync(outsideDir, path.join(context.workspaceRoot, '.agents'));

    repository = createWorkspaceRepository({
      dbFilePath: context.dbFilePath,
      now: () => 700
    });
    const manager = createWorkspaceSkillInjectionManager({
      workspaceId: 'workspace-integration-symlink-ancestor',
      workspaceRoot: context.workspaceRoot,
      repository,
      now: () => 700
    });

    expect(() =>
      manager.prepareForRuntimeLaunch({
        runtimeKind: 'codex',
        bridgeUsageHint: BRIDGE_USAGE_HINT,
        cliUsageHint: CLI_USAGE_HINT
      })
    ).toThrow('Managed workspace skill path cannot traverse a symlink');
    expect(fs.existsSync(path.join(context.workspaceRoot, 'AGENTS.md'))).toBe(false);
    expect(fs.existsSync(path.join(outsideDir, 'skills', 'openweave-workspace.md'))).toBe(false);
  });

  it('rejects revalidation through a symlinked managed file path', () => {
    const context = createTestContext();
    repository = createWorkspaceRepository({
      dbFilePath: context.dbFilePath,
      now: () => 800
    });
    const manager = createWorkspaceSkillInjectionManager({
      workspaceId: 'workspace-integration-symlink-read',
      workspaceRoot: context.workspaceRoot,
      repository,
      now: () => 800
    });

    manager.prepareForRuntimeLaunch({
      runtimeKind: 'codex',
      bridgeUsageHint: BRIDGE_USAGE_HINT,
      cliUsageHint: CLI_USAGE_HINT
    });

    const managedFilePath = path.join(context.workspaceRoot, '.agents', 'skills', 'openweave-workspace.md');
    const outsideFilePath = path.join(testDir, 'outside-managed-file.md');
    fs.renameSync(managedFilePath, outsideFilePath);
    fs.symlinkSync(outsideFilePath, managedFilePath);

    expect(() =>
      manager.prepareForRuntimeLaunch({
        runtimeKind: 'codex',
        bridgeUsageHint: BRIDGE_USAGE_HINT,
        cliUsageHint: CLI_USAGE_HINT
      })
    ).toThrow('Managed workspace skill path cannot traverse a symlink');
    expect(fs.readFileSync(outsideFilePath, 'utf8')).toContain(BRIDGE_USAGE_HINT);
    expect(repository.getSkillInjection('codex')).not.toBeNull();
  });

  it('rejects cleanup through a symlinked managed file path', () => {
    const context = createTestContext();
    repository = createWorkspaceRepository({
      dbFilePath: context.dbFilePath,
      now: () => 900
    });
    const manager = createWorkspaceSkillInjectionManager({
      workspaceId: 'workspace-integration-symlink-cleanup',
      workspaceRoot: context.workspaceRoot,
      repository,
      now: () => 900
    });

    manager.prepareForRuntimeLaunch({
      runtimeKind: 'codex',
      bridgeUsageHint: BRIDGE_USAGE_HINT,
      cliUsageHint: CLI_USAGE_HINT
    });

    const managedFilePath = path.join(context.workspaceRoot, 'AGENTS.md');
    const outsideFilePath = path.join(testDir, 'outside-agents.md');
    fs.renameSync(managedFilePath, outsideFilePath);
    fs.symlinkSync(outsideFilePath, managedFilePath);

    expect(() => manager.cleanupRuntimeInjection('codex')).toThrow(
      'Managed workspace skill path cannot traverse a symlink'
    );
    expect(fs.existsSync(outsideFilePath)).toBe(true);
    expect(repository.getSkillInjection('codex')).not.toBeNull();
  });

  it('fails closed instead of overwriting a user-modified managed file during a runtime switch', () => {
    const context = createTestContext();
    repository = createWorkspaceRepository({
      dbFilePath: context.dbFilePath,
      now: () => 950
    });
    const manager = createWorkspaceSkillInjectionManager({
      workspaceId: 'workspace-integration-user-modified-switch',
      workspaceRoot: context.workspaceRoot,
      repository,
      now: () => 950
    });

    manager.prepareForRuntimeLaunch({
      runtimeKind: 'codex',
      bridgeUsageHint: BRIDGE_USAGE_HINT,
      cliUsageHint: CLI_USAGE_HINT
    });

    const agentsPath = path.join(context.workspaceRoot, 'AGENTS.md');
    fs.writeFileSync(agentsPath, '# user override\n', 'utf8');

    expect(() =>
      manager.prepareForRuntimeLaunch({
        runtimeKind: 'opencode',
        bridgeUsageHint: BRIDGE_USAGE_HINT,
        cliUsageHint: CLI_USAGE_HINT
      })
    ).toThrow('Managed workspace skill file was modified by the user');
    expect(fs.readFileSync(agentsPath, 'utf8')).toBe('# user override\n');
    expect(repository.getSkillInjection('codex')).not.toBeNull();
    expect(repository.getSkillInjection('opencode')).toBeNull();
  });

  it('fails closed before dropping the old runtime record when an old-runtime-only managed file was modified', () => {
    const context = createTestContext();
    repository = createWorkspaceRepository({
      dbFilePath: context.dbFilePath,
      now: () => 975
    });
    const manager = createWorkspaceSkillInjectionManager({
      workspaceId: 'workspace-integration-old-runtime-only-modified',
      workspaceRoot: context.workspaceRoot,
      repository,
      now: () => 975
    });

    manager.prepareForRuntimeLaunch({
      runtimeKind: 'codex',
      bridgeUsageHint: BRIDGE_USAGE_HINT,
      cliUsageHint: CLI_USAGE_HINT
    });

    const codexOnlyPath = path.join(context.workspaceRoot, '.agents', 'skills', 'openweave-workspace.md');
    fs.writeFileSync(codexOnlyPath, '# user-modified codex-only skill\n', 'utf8');

    expect(() =>
      manager.prepareForRuntimeLaunch({
        runtimeKind: 'claude',
        bridgeUsageHint: BRIDGE_USAGE_HINT,
        cliUsageHint: CLI_USAGE_HINT
      })
    ).toThrow('Managed workspace skill file was modified by the user');
    expect(fs.readFileSync(codexOnlyPath, 'utf8')).toBe('# user-modified codex-only skill\n');
    expect(repository.getSkillInjection('codex')).not.toBeNull();
    expect(repository.getSkillInjection('claude')).toBeNull();
    expect(fs.existsSync(path.join(context.workspaceRoot, '.claude', 'skills', 'openweave-workspace.md'))).toBe(
      false
    );
  });
});
