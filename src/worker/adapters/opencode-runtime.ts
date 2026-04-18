import {
  launchShellRuntime,
  type RuntimeAdapterInput,
  type RuntimeAdapterProcess
} from './shell-runtime';

export const launchOpenCodeRuntime = (input: RuntimeAdapterInput): RuntimeAdapterProcess => {
  const command = input.command.trim();
  if (command.length === 0) {
    throw new Error('OpenCode runtime command cannot be empty');
  }

  return launchShellRuntime({
    ...input,
    command: `opencode ${command}`
  });
};
