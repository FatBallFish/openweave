import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  installBuiltinSkills,
  uninstallBuiltinSkills
} from '../../../src/main/skills/app-skill-manager';

describe('app-skill-manager', () => {
  let tempSkillsDir: string;

  beforeEach(() => {
    tempSkillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ow-skills-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempSkillsDir)) {
      fs.rmSync(tempSkillsDir, { recursive: true, force: true });
    }
  });

  it('installs builtin skills to user directory', () => {
    installBuiltinSkills(tempSkillsDir);
    expect(fs.existsSync(path.join(tempSkillsDir, 'SKILL.md'))).toBe(true);
  });

  it('uninstalls builtin skills from user directory', () => {
    installBuiltinSkills(tempSkillsDir);
    uninstallBuiltinSkills(tempSkillsDir);
    expect(fs.existsSync(tempSkillsDir)).toBe(false);
  });
});
