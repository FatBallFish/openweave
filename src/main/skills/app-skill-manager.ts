import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const BUILTIN_SKILLS_DIR = path.join(__dirname, '..', '..', '..', 'docs', 'skills', 'openweave');
const USER_SKILLS_DIR = path.join(os.homedir(), '.agents', 'skills');

export const installBuiltinSkills = (userSkillsDir?: string): void => {
  if (!fs.existsSync(BUILTIN_SKILLS_DIR)) {
    return;
  }

  const targetDir = userSkillsDir ?? path.join(os.homedir(), '.agents', 'skills', 'openweave');
  fs.mkdirSync(targetDir, { recursive: true });

  for (const file of ['SKILL.md', 'SKILL.zh-CN.md']) {
    const source = path.join(BUILTIN_SKILLS_DIR, file);
    const dest = path.join(targetDir, file);
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, dest);
    }
  }
};

export const uninstallBuiltinSkills = (userSkillsDir?: string): void => {
  const targetDir = userSkillsDir ?? path.join(os.homedir(), '.agents', 'skills', 'openweave');
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
};
