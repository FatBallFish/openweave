import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const BUILTIN_SKILLS_DIR = path.join(__dirname, '..', '..', '..', 'docs', 'skills', 'openweave');

const SKILL_TARGETS = [
  path.join(os.homedir(), '.agents', 'skills', 'openweave'),
  path.join(os.homedir(), '.claude', 'skills', 'openweave')
];

export const installBuiltinSkills = (userSkillsDir?: string): void => {
  if (!fs.existsSync(BUILTIN_SKILLS_DIR)) {
    return;
  }

  const targetDirs = userSkillsDir ? [userSkillsDir] : SKILL_TARGETS;
  for (const targetDir of targetDirs) {
    fs.mkdirSync(targetDir, { recursive: true });
    for (const file of ['SKILL.md', 'SKILL.zh-CN.md']) {
      const source = path.join(BUILTIN_SKILLS_DIR, file);
      const dest = path.join(targetDir, file);
      if (fs.existsSync(source)) {
        fs.copyFileSync(source, dest);
      }
    }
  }
};

export const uninstallBuiltinSkills = (userSkillsDir?: string): void => {
  const targetDirs = userSkillsDir ? [userSkillsDir] : SKILL_TARGETS;
  for (const targetDir of targetDirs) {
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  }
};
