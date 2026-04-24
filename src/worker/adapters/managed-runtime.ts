import {
  launchShellRuntime,
  type RuntimeAdapterInput,
  type RuntimeAdapterProcess
} from './shell-runtime';

const MANAGED_RUNTIME_BOOT_DELAY_MS = 32;

export const launchManagedRuntimeInShell = (
  input: RuntimeAdapterInput,
  defaultCommand: string
): RuntimeAdapterProcess => {
  const startupCommand = input.command.trim().length === 0 ? defaultCommand : input.command.trim();
  const runtimeProcess = launchShellRuntime({
    ...input,
    command: ''
  });

  let bootstrapped = false;
  const bootstrap = (): void => {
    if (bootstrapped) {
      return;
    }
    bootstrapped = true;
    runtimeProcess.write(`${startupCommand}\r`);
  };

  const timer = setTimeout(bootstrap, MANAGED_RUNTIME_BOOT_DELAY_MS);
  runtimeProcess.stdout.once('data', () => {
    clearTimeout(timer);
    setTimeout(bootstrap, 0);
  });

  return runtimeProcess;
};
