import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { injectRole, cleanupRoleInjection } from '../../../src/main/terminal/role-injector';

describe('role-injector', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ow-role-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates role directory and writes AGENTS.md and CLAUDE.md', () => {
    const roleDir = injectRole({
      workingDir: tempDir,
      terminalId: 'term-123',
      roleDescription: 'You are a test role.'
    });

    expect(fs.existsSync(roleDir)).toBe(true);
    expect(fs.existsSync(path.join(roleDir, 'AGENTS.md'))).toBe(true);
    expect(fs.existsSync(path.join(roleDir, 'CLAUDE.md'))).toBe(true);

    const content = fs.readFileSync(path.join(roleDir, 'AGENTS.md'), 'utf8');
    expect(content).toContain('You are a test role.');
    expect(content).toContain(tempDir);
  });

  it('cleanupRoleInjection removes the role directory', () => {
    injectRole({
      workingDir: tempDir,
      terminalId: 'term-456',
      roleDescription: 'Cleanup test.'
    });

    cleanupRoleInjection(tempDir, 'term-456');
    expect(fs.existsSync(path.join(tempDir, '.openweave', 'roles', 'term-456'))).toBe(false);
  });
});
