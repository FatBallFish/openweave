import {
  type RuntimeAdapterInput,
  type RuntimeAdapterProcess
} from './shell-runtime';
import { launchManagedRuntimeInShell } from './managed-runtime';

export const launchOpenCodeRuntime = (input: RuntimeAdapterInput): RuntimeAdapterProcess => {
  return launchManagedRuntimeInShell(input, 'opencode');
};
