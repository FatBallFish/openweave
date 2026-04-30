import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const SKILLS_ROOT = path.join(__dirname, '..', '..', '..', 'docs', 'skills');

const BUILTIN_SKILL_NAMES = ['openweave', 'openweave-portal'];

const SKILL_BASE_TARGETS = [
  path.join(os.homedir(), '.agents', 'skills'),
  path.join(os.homedir(), '.claude', 'skills')
];

const copySkillDir = (sourceDir: string, targetDir: string): void => {
  if (!fs.existsSync(sourceDir)) {
    return;
  }
  fs.mkdirSync(targetDir, { recursive: true });
  for (const file of ['SKILL.md', 'SKILL.zh-CN.md']) {
    const source = path.join(sourceDir, file);
    const dest = path.join(targetDir, file);
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, dest);
    }
  }
};

export const installBuiltinSkills = (userSkillsDir?: string): void => {
  for (const skillName of BUILTIN_SKILL_NAMES) {
    const sourceDir = path.join(SKILLS_ROOT, skillName);
    if (userSkillsDir) {
      copySkillDir(sourceDir, path.join(userSkillsDir, skillName));
    } else {
      for (const baseDir of SKILL_BASE_TARGETS) {
        copySkillDir(sourceDir, path.join(baseDir, skillName));
      }
    }
  }
};

export const uninstallBuiltinSkills = (userSkillsDir?: string): void => {
  for (const skillName of BUILTIN_SKILL_NAMES) {
    if (userSkillsDir) {
      const targetDir = path.join(userSkillsDir, skillName);
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
    } else {
      for (const baseDir of SKILL_BASE_TARGETS) {
        const targetDir = path.join(baseDir, skillName);
        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }
      }
    }
  }
};
