import {
  launchShellRuntime,
  type RuntimeAdapterInput,
  type RuntimeAdapterProcess
} from './shell-runtime';

export const launchClaudeRuntime = (input: RuntimeAdapterInput): RuntimeAdapterProcess => {
  const command = input.command.trim();
  if (command.length === 0) {
    throw new Error('Claude runtime command cannot be empty');
  }

  return launchShellRuntime({
    ...input,
    command: `claude ${command}`
  });
};
