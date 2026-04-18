import type { ComponentActionAdapter } from '../component-action-dispatcher';
import {
  createNodeActionNotSupportedError,
  hasCapability,
  isSupportedReadMode
} from './shared';

interface NormalizedAttachmentRecord {
  id: string;
  name: string;
  path: string;
  mimeType: string | null;
  sizeBytes: number | null;
}

const toAttachmentDisplayName = (value: string): string => {
  const segments = value.split(/[\\/]/);
  return segments[segments.length - 1] || value;
};

const normalizeAttachments = (value: unknown): NormalizedAttachmentRecord[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((candidate, index) => {
    const record =
      candidate && typeof candidate === 'object' ? (candidate as Record<string, unknown>) : {};
    const path = typeof record.path === 'string' ? record.path : '';

    if (path === '') {
      return [];
    }

    const fallbackId = `attachment-${index + 1}`;
    const name =
      typeof record.name === 'string' && record.name !== '' ? record.name : toAttachmentDisplayName(path);

    return [
      {
        id: typeof record.id === 'string' ? record.id : fallbackId,
        name,
        path,
        mimeType: typeof record.mimeType === 'string' ? record.mimeType : null,
        sizeBytes:
          typeof record.sizeBytes === 'number' &&
          Number.isFinite(record.sizeBytes) &&
          record.sizeBytes >= 0
            ? record.sizeBytes
            : null
      }
    ];
  });
};

const summarizeAttachments = (attachments: NormalizedAttachmentRecord[]): string => {
  if (attachments.length === 0) {
    return '0 attachments';
  }

  const label = attachments.length === 1 ? 'attachment' : 'attachments';
  const names = attachments.map((attachment) => attachment.name).filter((name) => name !== '');

  if (names.length === 0) {
    return `${attachments.length} ${label}`;
  }

  return `${attachments.length} ${label}: ${names.join(', ')}`;
};

export const createBuiltinAttachmentActionAdapter = (): ComponentActionAdapter => {
  return {
    supports: (componentType) => componentType === 'builtin.attachment',
    read: (context, input) => {
      if (!hasCapability(context.node, 'read') || !isSupportedReadMode(input.mode)) {
        throw createNodeActionNotSupportedError();
      }

      const attachments = normalizeAttachments(context.node.state.attachments);

      return {
        nodeId: context.node.id,
        action: 'read',
        result: {
          content: summarizeAttachments(attachments),
          count: attachments.length,
          attachments
        }
      };
    },
    action: () => {
      throw createNodeActionNotSupportedError();
    }
  };
};
