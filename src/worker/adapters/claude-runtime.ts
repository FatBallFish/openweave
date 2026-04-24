import {
  type RuntimeAdapterInput,
  type RuntimeAdapterProcess
} from './shell-runtime';
import { launchManagedRuntimeInShell } from './managed-runtime';

export const launchClaudeRuntime = (input: RuntimeAdapterInput): RuntimeAdapterProcess => {
  return launchManagedRuntimeInShell(input, 'claude');
};
