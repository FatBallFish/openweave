import type { GraphSnapshotV2Input } from '../../../shared/ipc/schemas';
import type { ComponentActionAdapter } from '../component-action-dispatcher';
import {
  createNodeActionNotSupportedError,
  hasCapability,
  isSupportedReadMode
} from './shared';

export const createBuiltinNoteActionAdapter = (): ComponentActionAdapter => {
  return {
    supports: (componentType) => componentType === 'builtin.note',
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
    action: (context, input) => {
      if (input.action !== 'write' || !hasCapability(context.node, 'write')) {
        throw createNodeActionNotSupportedError();
      }

      const content = input.payload?.content;
      if (typeof content !== 'string') {
        throw new Error('Invalid payload: content must be a string');
      }

      const now = Date.now();
      const nextGraph: GraphSnapshotV2Input = {
        ...context.graph,
        nodes: context.graph.nodes.map((candidate) =>
          candidate.id === context.node.id
            ? {
                ...candidate,
                state: {
                  ...candidate.state,
                  content
                },
                updatedAtMs: now
              }
            : candidate
        )
      };

      context.saveGraph(nextGraph);

      return {
        nodeId: context.node.id,
        action: input.action,
        ok: true,
        result: {
          updated: true
        }
      };
    }
  };
};
