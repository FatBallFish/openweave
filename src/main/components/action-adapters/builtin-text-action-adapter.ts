import type { ComponentActionAdapter } from '../component-action-dispatcher';
import {
  createNodeActionNotSupportedError,
  hasCapability,
  isSupportedReadMode
} from './shared';

export const createBuiltinTextActionAdapter = (): ComponentActionAdapter => {
  return {
    supports: (componentType) => componentType === 'builtin.text',
    read: (context, input) => {
      if (!hasCapability(context.node, 'read') || !isSupportedReadMode(input.mode)) {
        throw createNodeActionNotSupportedError();
      }

      return {
        nodeId: context.node.id,
        action: 'read',
        result: {
          content: typeof context.node.state.content === 'string' ? context.node.state.content : ''
        }
      };
    },
    action: () => {
      throw createNodeActionNotSupportedError();
    }
  };
};
