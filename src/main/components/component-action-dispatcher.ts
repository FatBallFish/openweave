import type { GraphNodeActionResponse, GraphNodeReadResponse } from '../../shared/ipc/contracts';
import type { GraphSnapshotV2Input } from '../../shared/ipc/schemas';

export interface NodeActionContext {
  workspaceId: string;
  graph: GraphSnapshotV2Input;
  node: GraphSnapshotV2Input['nodes'][number];
  saveGraph: (nextGraph: GraphSnapshotV2Input) => void;
}

export interface ComponentActionAdapter {
  supports: (componentType: string) => boolean;
  read?: (context: NodeActionContext, input: { mode?: string }) => GraphNodeReadResponse;
  action?: (
    context: NodeActionContext,
    input: { action: string; payload?: Record<string, unknown> }
  ) => GraphNodeActionResponse;
}

export interface ComponentActionDispatcher {
  read: (context: NodeActionContext, input: { mode?: string }) => GraphNodeReadResponse;
  action: (
    context: NodeActionContext,
    input: { action: string; payload?: Record<string, unknown> }
  ) => GraphNodeActionResponse;
}

export interface CreateComponentActionDispatcherOptions {
  adapters: ComponentActionAdapter[];
}

const createNodeActionNotSupportedError = (): Error => new Error('NODE_ACTION_NOT_SUPPORTED');

const resolveAdapter = (
  adapters: ComponentActionAdapter[],
  componentType: string
): ComponentActionAdapter | null => {
  for (const adapter of adapters) {
    if (adapter.supports(componentType)) {
      return adapter;
    }
  }
  return null;
};

export const createComponentActionDispatcher = (
  options: CreateComponentActionDispatcherOptions
): ComponentActionDispatcher => {
  return {
    read: (context, input) => {
      const adapter = resolveAdapter(options.adapters, context.node.componentType);
      if (!adapter || !adapter.read) {
        throw createNodeActionNotSupportedError();
      }
      return adapter.read(context, input);
    },
    action: (context, input) => {
      const adapter = resolveAdapter(options.adapters, context.node.componentType);
      if (!adapter || !adapter.action) {
        throw createNodeActionNotSupportedError();
      }
      return adapter.action(context, input);
    }
  };
};
