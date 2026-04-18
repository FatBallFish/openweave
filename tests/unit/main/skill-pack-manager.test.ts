import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SkillPackManagerError,
  createSkillPackManager
} from '../../../src/main/skills/skill-pack-manager';

const BRIDGE_USAGE_HINT = 'Use the OpenWeave bridge to resolve workspace nodes.';
const CLI_USAGE_HINT = 'Use the openweave CLI from the workspace root.';

let testDir = '';

const createWorkspaceRoot = (): string => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-skill-pack-manager-unit-'));
  const workspaceRoot = path.join(testDir, 'workspace');
  fs.mkdirSync(workspaceRoot, { recursive: true });
  return workspaceRoot;
};

const readGeneratedFiles = (workspaceRoot: string): Record<string, string> => {
  const generatedFiles: Record<string, string> = {};
  const pending = [workspaceRoot];

  while (pending.length > 0) {
    const directoryPath = pending.pop();
    if (!directoryPath) {
      continue;
    }

    const childNames = fs.readdirSync(directoryPath).sort((left, right) => left.localeCompare(right));
    for (const childName of childNames) {
      const entryPath = path.join(directoryPath, childName);
      const relativePath = path.relative(workspaceRoot, entryPath);
      const stats = fs.lstatSync(entryPath);
      if (stats.isDirectory()) {
        pending.push(entryPath);
        continue;
      }
      generatedFiles[relativePath] = fs.readFileSync(entryPath, 'utf8');
    }
  }

  return generatedFiles;
};

afterEach(() => {
  if (testDir !== '') {
    fs.rmSync(testDir, { recursive: true, force: true });
    testDir = '';
  }
});

describe('skill pack manager', () => {
  it('generates Codex guidance with AGENTS.md and one managed skill file', () => {
    const workspaceRoot = createWorkspaceRoot();
    const manager = createSkillPackManager();

    const result = manager.generateSkillPack({
      workspaceId: 'workspace-codex',
      workspaceRoot,
      runtimeKind: 'codex',
      bridgeUsageHint: BRIDGE_USAGE_HINT,
      cliUsageHint: CLI_USAGE_HINT
    });

    expect(result.files.map((file) => file.relativePath)).toEqual([
      '.agents/skills/openweave-workspace.md',
      'AGENTS.md'
    ]);

    const generatedFiles = readGeneratedFiles(workspaceRoot);
    expect(Object.keys(generatedFiles).sort((left, right) => left.localeCompare(right))).toEqual([
      '.agents/skills/openweave-workspace.md',
      'AGENTS.md'
    ]);
    expect(generatedFiles['AGENTS.md']).toContain('runtime: codex');
    expect(generatedFiles['AGENTS.md']).toContain('workspace id: workspace-codex');
    expect(generatedFiles['.agents/skills/openweave-workspace.md']).toContain(BRIDGE_USAGE_HINT);
    expect(generatedFiles['.agents/skills/openweave-workspace.md']).toContain(CLI_USAGE_HINT);
  });

  it('generates Claude guidance with one managed skill file', () => {
    const workspaceRoot = createWorkspaceRoot();
    const manager = createSkillPackManager();

    const result = manager.generateSkillPack({
      workspaceId: 'workspace-claude',
      workspaceRoot,
      runtimeKind: 'claude',
      bridgeUsageHint: BRIDGE_USAGE_HINT,
      cliUsageHint: CLI_USAGE_HINT
    });

    expect(result.files.map((file) => file.relativePath)).toEqual(['.claude/skills/openweave-workspace.md']);

    const generatedFiles = readGeneratedFiles(workspaceRoot);
    expect(Object.keys(generatedFiles)).toEqual(['.claude/skills/openweave-workspace.md']);
    expect(generatedFiles['.claude/skills/openweave-workspace.md']).toContain('runtime: claude');
    expect(generatedFiles['.claude/skills/openweave-workspace.md']).toContain('workspace id: workspace-claude');
  });

  it('generates OpenCode guidance with AGENTS.md and one managed skill file', () => {
    const workspaceRoot = createWorkspaceRoot();
    const manager = createSkillPackManager();

    const result = manager.generateSkillPack({
      workspaceId: 'workspace-opencode',
      workspaceRoot,
      runtimeKind: 'opencode',
      bridgeUsageHint: BRIDGE_USAGE_HINT,
      cliUsageHint: CLI_USAGE_HINT
    });

    expect(result.files.map((file) => file.relativePath)).toEqual([
      '.opencode/skills/openweave-workspace.md',
      'AGENTS.md'
    ]);

    const generatedFiles = readGeneratedFiles(workspaceRoot);
    expect(Object.keys(generatedFiles).sort((left, right) => left.localeCompare(right))).toEqual([
      '.opencode/skills/openweave-workspace.md',
      'AGENTS.md'
    ]);
    expect(generatedFiles['AGENTS.md']).toContain('runtime: opencode');
    expect(generatedFiles['.opencode/skills/openweave-workspace.md']).toContain(BRIDGE_USAGE_HINT);
  });

  it('is deterministic when generation runs repeatedly with the same inputs', () => {
    const workspaceRoot = createWorkspaceRoot();
    const manager = createSkillPackManager();
    const input = {
      workspaceId: 'workspace-deterministic',
      workspaceRoot,
      runtimeKind: 'codex' as const,
      bridgeUsageHint: BRIDGE_USAGE_HINT,
      cliUsageHint: CLI_USAGE_HINT
    };

    const firstResult = manager.generateSkillPack(input);
    const firstFiles = readGeneratedFiles(workspaceRoot);
    const secondResult = manager.generateSkillPack(input);
    const secondFiles = readGeneratedFiles(workspaceRoot);

    expect(firstResult).toEqual(secondResult);
    expect(secondFiles).toEqual(firstFiles);
  });

  it('uses self-contained built-in templates when no template root is provided', () => {
    const workspaceRoot = createWorkspaceRoot();
    const manager = createSkillPackManager();
    const originalReadFileSync = fs.readFileSync;
    const readFileSyncSpy = vi.spyOn(fs, 'readFileSync').mockImplementation(((...args: Parameters<typeof fs.readFileSync>) => {
      const filePath = args[0];
      if (typeof filePath === 'string' && filePath.endsWith('.tpl')) {
        throw new Error('template files should not be loaded from disk');
      }
      return originalReadFileSync(...args);
    }) as typeof fs.readFileSync);

    try {
      const result = manager.generateSkillPack({
        workspaceId: 'workspace-embedded-templates',
        workspaceRoot,
        runtimeKind: 'codex',
        bridgeUsageHint: BRIDGE_USAGE_HINT,
        cliUsageHint: CLI_USAGE_HINT
      });

      expect(result.files.map((file) => file.relativePath)).toEqual([
        '.agents/skills/openweave-workspace.md',
        'AGENTS.md'
      ]);
    } finally {
      readFileSyncSpy.mockRestore();
    }

    const generatedFiles = readGeneratedFiles(workspaceRoot);
    expect(generatedFiles['AGENTS.md']).toContain('workspace id: workspace-embedded-templates');
  });

  it('surfaces a stable error when a template file is missing', () => {
    const workspaceRoot = createWorkspaceRoot();
    const manager = createSkillPackManager({
      templateRoot: path.join(testDir, 'missing-templates')
    });

    let thrownError: unknown;
    try {
      manager.generateSkillPack({
        workspaceId: 'workspace-template-error',
        workspaceRoot,
        runtimeKind: 'codex',
        bridgeUsageHint: BRIDGE_USAGE_HINT,
        cliUsageHint: CLI_USAGE_HINT
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(SkillPackManagerError);
    expect((thrownError as SkillPackManagerError).code).toBe('SKILL_PACK_TEMPLATE_ERROR');
    expect((thrownError as SkillPackManagerError).message).toBe(
      'Skill pack template could not be loaded: codex/agents.md.tpl'
    );
  });

  it('surfaces a stable error for an unsupported runtime kind', () => {
    const workspaceRoot = createWorkspaceRoot();
    const manager = createSkillPackManager();

    let thrownError: unknown;
    try {
      manager.generateSkillPack({
        workspaceId: 'workspace-invalid-runtime',
        workspaceRoot,
        runtimeKind: 'unknown-runtime' as unknown as 'codex',
        bridgeUsageHint: BRIDGE_USAGE_HINT,
        cliUsageHint: CLI_USAGE_HINT
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(SkillPackManagerError);
    expect((thrownError as SkillPackManagerError).code).toBe('SKILL_PACK_RUNTIME_ERROR');
    expect((thrownError as SkillPackManagerError).message).toBe(
      'Skill pack runtime is not supported: unknown-runtime'
    );
  });

  it('surfaces a stable error when a managed file cannot be written', () => {
    const workspaceRoot = createWorkspaceRoot();
    fs.mkdirSync(path.join(workspaceRoot, 'AGENTS.md'));
    const manager = createSkillPackManager();

    let thrownError: unknown;
    try {
      manager.generateSkillPack({
        workspaceId: 'workspace-write-error',
        workspaceRoot,
        runtimeKind: 'codex',
        bridgeUsageHint: BRIDGE_USAGE_HINT,
        cliUsageHint: CLI_USAGE_HINT
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(SkillPackManagerError);
    expect((thrownError as SkillPackManagerError).code).toBe('SKILL_PACK_WRITE_ERROR');
    expect((thrownError as SkillPackManagerError).message).toBe(
      'Skill pack file could not be written: AGENTS.md'
    );
  });

  it('rolls back earlier files when a later managed file write fails', () => {
    const workspaceRoot = createWorkspaceRoot();
    const manager = createSkillPackManager();
    const originalWriteFileSync = fs.writeFileSync;
    const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(
      ((...args: Parameters<typeof fs.writeFileSync>) => {
        const filePath = args[0];
        if (typeof filePath === 'string' && filePath.endsWith('.agents/skills/openweave-workspace.md')) {
          throw new Error('simulated later write failure');
        }
        return originalWriteFileSync(...args);
      }) as typeof fs.writeFileSync
    );

    let thrownError: unknown;
    try {
      manager.generateSkillPack({
        workspaceId: 'workspace-rollback',
        workspaceRoot,
        runtimeKind: 'codex',
        bridgeUsageHint: BRIDGE_USAGE_HINT,
        cliUsageHint: CLI_USAGE_HINT
      });
    } catch (error) {
      thrownError = error;
    } finally {
      writeFileSyncSpy.mockRestore();
    }

    expect(thrownError).toBeInstanceOf(SkillPackManagerError);
    expect((thrownError as SkillPackManagerError).code).toBe('SKILL_PACK_WRITE_ERROR');
    expect((thrownError as SkillPackManagerError).message).toBe(
      'Skill pack file could not be written: .agents/skills/openweave-workspace.md'
    );
    expect(readGeneratedFiles(workspaceRoot)).toEqual({});
  });

  it('restores a pre-existing managed file when a later write fails', () => {
    const workspaceRoot = createWorkspaceRoot();
    const preexistingAgentsContent = '# existing workspace guidance\n';
    fs.writeFileSync(path.join(workspaceRoot, 'AGENTS.md'), preexistingAgentsContent, 'utf8');

    const manager = createSkillPackManager();
    const originalWriteFileSync = fs.writeFileSync;
    const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(
      ((...args: Parameters<typeof fs.writeFileSync>) => {
        const filePath = args[0];
        if (typeof filePath === 'string' && filePath.endsWith('.agents/skills/openweave-workspace.md')) {
          throw new Error('simulated later write failure');
        }
        return originalWriteFileSync(...args);
      }) as typeof fs.writeFileSync
    );

    let thrownError: unknown;
    try {
      manager.generateSkillPack({
        workspaceId: 'workspace-rollback-restore',
        workspaceRoot,
        runtimeKind: 'codex',
        bridgeUsageHint: BRIDGE_USAGE_HINT,
        cliUsageHint: CLI_USAGE_HINT
      });
    } catch (error) {
      thrownError = error;
    } finally {
      writeFileSyncSpy.mockRestore();
    }

    expect(thrownError).toBeInstanceOf(SkillPackManagerError);
    expect((thrownError as SkillPackManagerError).code).toBe('SKILL_PACK_WRITE_ERROR');
    expect(fs.readFileSync(path.join(workspaceRoot, 'AGENTS.md'), 'utf8')).toBe(preexistingAgentsContent);
    expect(fs.existsSync(path.join(workspaceRoot, '.agents', 'skills', 'openweave-workspace.md'))).toBe(false);
  });

  it('restores a pre-existing current target when its write fails after partial overwrite', () => {
    const workspaceRoot = createWorkspaceRoot();
    const preexistingAgentsContent = '# original agents content\n';
    const agentsPath = path.join(workspaceRoot, 'AGENTS.md');
    fs.writeFileSync(agentsPath, preexistingAgentsContent, 'utf8');

    const manager = createSkillPackManager();
    const originalWriteFileSync = fs.writeFileSync;
    let hasFailedCurrentTargetWrite = false;
    const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(
      ((...args: Parameters<typeof fs.writeFileSync>) => {
        const filePath = args[0];
        if (typeof filePath === 'string' && filePath === agentsPath && !hasFailedCurrentTargetWrite) {
          hasFailedCurrentTargetWrite = true;
          originalWriteFileSync(filePath, 'partial overwrite\n', 'utf8');
          throw new Error('simulated current target write failure');
        }
        return originalWriteFileSync(...args);
      }) as typeof fs.writeFileSync
    );

    let thrownError: unknown;
    try {
      manager.generateSkillPack({
        workspaceId: 'workspace-current-target-rollback',
        workspaceRoot,
        runtimeKind: 'codex',
        bridgeUsageHint: BRIDGE_USAGE_HINT,
        cliUsageHint: CLI_USAGE_HINT
      });
    } catch (error) {
      thrownError = error;
    } finally {
      writeFileSyncSpy.mockRestore();
    }

    expect(thrownError).toBeInstanceOf(SkillPackManagerError);
    expect((thrownError as SkillPackManagerError).code).toBe('SKILL_PACK_WRITE_ERROR');
    expect((thrownError as SkillPackManagerError).message).toBe(
      'Skill pack file could not be written: AGENTS.md'
    );
    expect(fs.readFileSync(agentsPath, 'utf8')).toBe(preexistingAgentsContent);
  });
});
