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

  it('installs the current workspace CLI command reference instead of the legacy command list', () => {
    installBuiltinSkills(tempSkillsDir);

    const englishSkill = fs.readFileSync(path.join(tempSkillsDir, 'SKILL.md'), 'utf8');
    const chineseSkill = fs.readFileSync(path.join(tempSkillsDir, 'SKILL.zh-CN.md'), 'utf8');

    expect(englishSkill).toContain('openweave workspace info');
    expect(englishSkill).toContain('openweave node list');
    expect(englishSkill).toContain('openweave node get [<nodeId>]');
    expect(englishSkill).toContain('openweave node read [<nodeId>]');
    expect(englishSkill).toContain('openweave node action <terminalNodeId> send');
    expect(englishSkill).toContain('submit');
    expect(englishSkill).toContain('OPENWEAVE_WORKSPACE_ID');
    expect(englishSkill).toContain('OPENWEAVE_NODE_ID');
    expect(englishSkill).toContain('You are a node inside an OpenWeave workspace');
    expect(englishSkill).toContain('Before you finish a task');
    expect(englishSkill).toContain('notify another node or terminal');
    expect(englishSkill).toContain('default to `submit: true`');
    expect(englishSkill).toContain('include enough context');
    expect(englishSkill).toContain('Do not just print the reply in your own terminal');
    expect(englishSkill).toContain('use `openweave` to send the reply, acknowledgement, or result back');
    expect(englishSkill).toContain('must first use `openweave` to look for a matching node');
    expect(englishSkill).toContain('If no matching node exists, only then consider another channel');
    expect(englishSkill).not.toContain('openweave list');

    expect(chineseSkill).toContain('openweave workspace info');
    expect(chineseSkill).toContain('openweave node list');
    expect(chineseSkill).toContain('openweave node get [<nodeId>]');
    expect(chineseSkill).toContain('openweave node read [<nodeId>]');
    expect(chineseSkill).toContain('openweave node action <terminalNodeId> send');
    expect(chineseSkill).toContain('submit');
    expect(chineseSkill).toContain('OPENWEAVE_WORKSPACE_ID');
    expect(chineseSkill).toContain('OPENWEAVE_NODE_ID');
    expect(chineseSkill).toContain('你不是一个脱离画布的普通终端');
    expect(chineseSkill).toContain('完成任务前');
    expect(chineseSkill).toContain('通知其他节点');
    expect(chineseSkill).toContain('默认带上 `submit: true`');
    expect(chineseSkill).toContain('最好带上足够的上下文');
    expect(chineseSkill).toContain('不要只把回复内容打印在你自己的终端里');
    expect(chineseSkill).toContain('要用 `openweave` 把回复、确认或结果发回去');
    expect(chineseSkill).toContain('必须先通过 `openweave` 查询是否有匹配节点');
    expect(chineseSkill).toContain('如果确实查不到匹配节点，再考虑其他方式');
    expect(chineseSkill).not.toContain('openweave list');
  });

  it('uninstalls builtin skills from user directory', () => {
    installBuiltinSkills(tempSkillsDir);
    uninstallBuiltinSkills(tempSkillsDir);
    expect(fs.existsSync(tempSkillsDir)).toBe(false);
  });
});
