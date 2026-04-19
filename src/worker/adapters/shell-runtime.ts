import {
  launchPtyRuntime,
  type RuntimeAdapterInput,
  type RuntimeAdapterProcess
} from './pty-runtime';

export type { RuntimeAdapterInput, RuntimeAdapterProcess } from './pty-runtime';

export const launchShellRuntime = (input: RuntimeAdapterInput): RuntimeAdapterProcess => {
  return launchPtyRuntime(input);
};
