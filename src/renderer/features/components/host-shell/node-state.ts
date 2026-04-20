import type { RendererGraphNode } from '../hosts/types';

export type BuiltinNodeState = 'default' | 'running' | 'warning' | 'failed' | 'disabled';

const hasString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

export const resolveBuiltinNodeState = (node: RendererGraphNode): BuiltinNodeState => {
  if (node.config && typeof node.config === 'object' && 'disabled' in node.config && node.config.disabled === true) {
    return 'disabled';
  }

  if (node.state && typeof node.state === 'object') {
    if ('error' in node.state && hasString(node.state.error)) {
      return 'failed';
    }

    if ('warning' in node.state && hasString(node.state.warning)) {
      return 'warning';
    }

    if ('activeSessionId' in node.state && hasString(node.state.activeSessionId)) {
      return 'running';
    }
  }

  return 'default';
};

export const getBuiltinNodeStateLabel = (state: BuiltinNodeState): string => {
  switch (state) {
    case 'running':
      return 'Running';
    case 'warning':
      return 'Warning';
    case 'failed':
      return 'Failed';
    case 'disabled':
      return 'Disabled';
    default:
      return 'Ready';
  }
};
