import os from 'node:os';
import path from 'node:path';
import {
  createLocalWorkspaceNodeQueryService,
  type LocalWorkspaceNodeQueryService
} from '../../main/bridge/workspace-node-query-service';
import { createPortalActionFileClient } from '../../main/bridge/portal-action-file-bridge';
import type {
  GraphNodeActionResponse,
  GraphNodeGetResponse,
  GraphNodeListResponse,
  GraphNodeNeighborsResponse,
  GraphNodeReadResponse,
  WorkspaceInfoResponse
} from '../../shared/ipc/contracts';

export interface CliWorkspaceNodeService {
  resolveWorkspaceId: (input: { workspaceId?: string; cwd: string }) => Promise<string>;
  getWorkspaceInfo: (input: { workspaceId: string }) => Promise<WorkspaceInfoResponse>;
  listNodes: (input: { workspaceId: string }) => Promise<GraphNodeListResponse>;
  getNode: (input: { workspaceId: string; nodeId: string }) => Promise<GraphNodeGetResponse>;
  getNodeNeighbors: (input: { workspaceId: string; nodeId: string }) => Promise<GraphNodeNeighborsResponse>;
  readNode: (input: { workspaceId: string; nodeId: string; mode?: string; sourceNodeId?: string }) => Promise<GraphNodeReadResponse>;
  runNodeAction: (input: {
    workspaceId: string;
    nodeId: string;
    action: string;
    payload?: Record<string, unknown>;
    sourceNodeId?: string;
  }) => Promise<GraphNodeActionResponse>;
  close?: () => void;
}

export interface CliWorkspaceNodeServiceOptions {
  env?: NodeJS.ProcessEnv;
}

interface WorkspaceNodeRuntimeOptions {
  registryDbFilePath: string;
  workspaceDbDir: string;
  portalActionRequestsDir: string;
}

export interface ResolveCliWorkspaceNodeRuntimeOptionsInput {
  env: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  homeDir?: string;
}

const resolveDefaultOpenWeaveUserDataDir = (
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  homeDir: string
): string => {
  if (env.OPENWEAVE_USER_DATA_DIR) {
    return path.resolve(env.OPENWEAVE_USER_DATA_DIR);
  }

  if (platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Application Support', 'openweave');
  }

  if (platform === 'win32') {
    const appDataDir = env.APPDATA ?? path.join(homeDir, 'AppData', 'Roaming');
    return path.join(appDataDir, 'openweave');
  }

  const configDir = env.XDG_CONFIG_HOME ?? path.join(homeDir, '.config');
  return path.join(configDir, 'openweave');
};

export const resolveCliWorkspaceNodeRuntimeOptions = (
  input: ResolveCliWorkspaceNodeRuntimeOptionsInput
): WorkspaceNodeRuntimeOptions => {
  const platform = input.platform ?? process.platform;
  const homeDir = input.homeDir ?? os.homedir();
  const userDataDir = resolveDefaultOpenWeaveUserDataDir(input.env, platform, homeDir);

  return {
    registryDbFilePath: path.resolve(input.env.OPENWEAVE_REGISTRY_DB_PATH ?? path.join(userDataDir, 'registry.db')),
    workspaceDbDir: path.resolve(input.env.OPENWEAVE_WORKSPACE_DB_DIR ?? path.join(userDataDir, 'workspaces')),
    portalActionRequestsDir: path.resolve(
      input.env.OPENWEAVE_PORTAL_ACTION_REQUESTS_DIR ?? path.join(userDataDir, 'portal-action-requests')
    )
  };
};

export const createCliWorkspaceNodeService = (
  options: CliWorkspaceNodeServiceOptions = {}
): CliWorkspaceNodeService => {
  const runtimeOptions = resolveCliWorkspaceNodeRuntimeOptions({
    env: options.env ?? process.env
  });
  const service: LocalWorkspaceNodeQueryService = createLocalWorkspaceNodeQueryService({
    registryDbFilePath: runtimeOptions.registryDbFilePath,
    workspaceDbDir: runtimeOptions.workspaceDbDir,
    portalDispatch: createPortalActionFileClient({
      requestsDir: runtimeOptions.portalActionRequestsDir,
      timeoutMs: Number.parseInt(options.env?.OPENWEAVE_PORTAL_ACTION_TIMEOUT_MS ?? '', 10) || undefined
    }).dispatch
  });

  return {
    resolveWorkspaceId: async (input) => service.resolveWorkspaceId(input),
    getWorkspaceInfo: async (input) => service.getWorkspaceInfo(input),
    listNodes: async (input) => service.listNodes(input),
    getNode: async (input) => service.getNode(input),
    getNodeNeighbors: async (input) => service.getNodeNeighbors(input),
    readNode: async (input) => service.readNode(input),
    runNodeAction: async (input) => service.runNodeAction(input),
    close: () => service.close()
  };
};

export const formatWorkspaceInfoText = (response: WorkspaceInfoResponse): string => {
  return [
    `Workspace: ${response.workspaceId}`,
    `Name: ${response.name}`,
    `Root: ${response.rootDir}`,
    `Graph schema: ${response.graphSchemaVersion}`,
    `Nodes: ${response.nodeCount}`,
    `Edges: ${response.edgeCount}`
  ].join('\n').concat('\n');
};
