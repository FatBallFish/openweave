import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

export interface RuntimeAdapterInput {
  command: string;
  cwd?: string;
  env: NodeJS.ProcessEnv;
}

export type RuntimeAdapterProcess = ChildProcessWithoutNullStreams;

export const launchShellRuntime = (input: RuntimeAdapterInput): RuntimeAdapterProcess => {
  return spawn(input.command, {
    cwd: input.cwd,
    env: input.env,
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true
  });
};
