import type { ComponentActionAdapter, NodeActionContext } from '../component-action-dispatcher';
import { createNodeActionNotSupportedError } from './shared';

const SUPPORTED_ACTIONS = ['navigate', 'capture', 'read-structure', 'click', 'input'] as const;

const ensurePortalDispatch = (
  context: NodeActionContext
): NonNullable<NodeActionContext['portalDispatch']> => {
  if (!context.portalDispatch) {
    throw createNodeActionNotSupportedError();
  }
  return context.portalDispatch;
};

export const createBuiltinPortalActionAdapter = (): ComponentActionAdapter => {
  return {
    supports: (componentType) => componentType === 'builtin.portal',
    action: async (context, input) => {
      if (!SUPPORTED_ACTIONS.includes(input.action as typeof SUPPORTED_ACTIONS[number])) {
        throw createNodeActionNotSupportedError();
      }

      const portalDispatch = ensurePortalDispatch(context);
      const payload = input.payload ?? {};

      const result = await portalDispatch({
        workspaceId: context.workspaceId,
        targetNodeId: context.node.id,
        action: input.action,
        payload
      });

      return {
        nodeId: context.node.id,
        action: input.action,
        ok: true,
        result: (result as Record<string, unknown>) ?? {}
      };
    }
  };
};
