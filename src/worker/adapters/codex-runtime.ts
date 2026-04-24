import {
  type RuntimeAdapterInput,
  type RuntimeAdapterProcess
} from './shell-runtime';
import { launchManagedRuntimeInShell } from './managed-runtime';

export const launchCodexRuntime = (input: RuntimeAdapterInput): RuntimeAdapterProcess => {
  return launchManagedRuntimeInShell(input, 'codex');
};
