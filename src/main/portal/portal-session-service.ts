import {
  type PortalSessionRecord,
  assertPortalUrlAllowed
} from '../../shared/portal/types';

export interface PortalSessionCreateInput {
  workspaceId: string;
  nodeId: string;
  url: string;
}

export interface PortalSessionService {
  upsertSession: (input: PortalSessionCreateInput) => PortalSessionRecord;
  getSession: (portalId: string) => PortalSessionRecord | null;
  deleteWorkspaceSessions: (workspaceId: string) => void;
  clear: () => void;
}

const toPortalSessionId = (workspaceId: string, nodeId: string): string => {
  return `${workspaceId}:${nodeId}`;
};

export interface PortalSessionServiceOptions {
  now?: () => number;
}

export const createPortalSessionService = (
  options: PortalSessionServiceOptions = {}
): PortalSessionService => {
  const now = options.now ?? (() => Date.now());
  const sessions = new Map<string, PortalSessionRecord>();

  return {
    upsertSession: (input: PortalSessionCreateInput): PortalSessionRecord => {
      const normalizedUrl = assertPortalUrlAllowed(input.url);
      const timestamp = now();
      const sessionId = toPortalSessionId(input.workspaceId, input.nodeId);
      const existing = sessions.get(sessionId);
      const session: PortalSessionRecord = existing
        ? {
            ...existing,
            url: normalizedUrl,
            updatedAtMs: timestamp
          }
        : {
            id: sessionId,
            workspaceId: input.workspaceId,
            nodeId: input.nodeId,
            url: normalizedUrl,
            createdAtMs: timestamp,
            updatedAtMs: timestamp
          };
      sessions.set(sessionId, session);
      return session;
    },
    getSession: (portalId: string): PortalSessionRecord | null => {
      return sessions.get(portalId) ?? null;
    },
    deleteWorkspaceSessions: (workspaceId: string): void => {
      for (const [portalId, session] of sessions) {
        if (session.workspaceId === workspaceId) {
          sessions.delete(portalId);
        }
      }
    },
    clear: (): void => {
      sessions.clear();
    }
  };
};
