import fs from 'node:fs';
import path from 'node:path';

export interface InjectRoleInput {
  workingDir: string;
  terminalId: string;
  roleDescription: string;
}

export const injectRole = (input: InjectRoleInput): string => {
  const roleDir = path.join(input.workingDir, '.openweave', 'roles', input.terminalId);
  fs.mkdirSync(roleDir, { recursive: true });

  const content = `<your_assigned_role>\n${input.roleDescription}\n</your_assigned_role>\n\n<working_directory> IMPORTANT: You were started in this directory to receive the above role assignment. The actual project you should be working on is located at: ${input.workingDir} </working_directory>\n`;

  fs.writeFileSync(path.join(roleDir, 'AGENTS.md'), content, 'utf8');
  fs.writeFileSync(path.join(roleDir, 'CLAUDE.md'), content, 'utf8');

  return roleDir;
};

export const cleanupRoleInjection = (workingDir: string, terminalId: string): void => {
  const roleDir = path.join(workingDir, '.openweave', 'roles', terminalId);
  if (fs.existsSync(roleDir)) {
    fs.rmSync(roleDir, { recursive: true, force: true });
  }
};
