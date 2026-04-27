import type { ComponentActionAdapter } from '../component-action-dispatcher';
import {
  createNodeActionNotSupportedError,
  hasCapability
} from './shared';

const normalizeTerminalInput = (
  payload: Record<string, unknown> | undefined
): string | null => {
  const directInput = payload?.input;
  if (typeof directInput === 'string') {
    return directInput;
  }

  const message = payload?.message;
  if (typeof message === 'string') {
    return message;
  }

  const content = payload?.content;
  if (typeof content === 'string') {
    return content;
  }

  return null;
};

const shouldSubmitTerminalInput = (payload: Record<string, unknown> | undefined): boolean => {
  return payload?.submit === true || payload?.enter === true || payload?.pressEnter === true;
};

const trimTrailingLineEndings = (value: string): string => {
  return value.replace(/(?:\r\n|\r|\n)+$/u, '');
};

export const createBuiltinTerminalActionAdapter = (): ComponentActionAdapter => {
  return {
    supports: (componentType) => componentType === 'builtin.terminal',
    action: (context, input) => {
      if (
        (input.action !== 'send' &&
          input.action !== 'input' &&
          input.action !== 'submit' &&
          input.action !== 'enter') ||
        !hasCapability(context.node, 'write') ||
        !context.enqueueTerminalDispatch
      ) {
        throw createNodeActionNotSupportedError();
      }

      let normalizedInput = '';
      let submitted = false;

      if (input.action === 'submit' || input.action === 'enter') {
        normalizedInput = '\r';
        submitted = true;
      } else {
        const directInput = normalizeTerminalInput(input.payload);
        if (typeof directInput !== 'string') {
          throw new Error('Invalid payload: input must be a string');
        }

        submitted = shouldSubmitTerminalInput(input.payload);
        normalizedInput = submitted ? `${trimTrailingLineEndings(directInput)}\r` : directInput;
      }

      context.enqueueTerminalDispatch({
        workspaceId: context.workspaceId,
        targetNodeId: context.node.id,
        action: input.action,
        inputText: normalizedInput
      });

      return {
        nodeId: context.node.id,
        action: input.action,
        ok: true,
        result: {
          queued: true,
          input: normalizedInput,
          ...(submitted ? { submitted: true } : {})
        }
      };
    }
  };
};
