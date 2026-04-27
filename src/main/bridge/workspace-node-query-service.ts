import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRegistryRepository, type RegistryRepository } from '../db/registry';
import { createWorkspaceRepository, type WorkspaceRepository } from '../db/workspace';
import {
  type ComponentActionDispatcher
} from '../components/component-action-dispatcher';
import { createDefaultComponentActionDispatcher } from '../components/component-action-adapter-registry';
import type {
  GraphNodeActionResponse,
  GraphNodeGetResponse,
  GraphNodeRecord,
  GraphNodeListResponse,
  GraphNodeNeighborsResponse,
  GraphNodeReadResponse,
  WorkspaceInfoResponse
} from '../../shared/ipc/contracts';

export interface ResolveWorkspaceIdInput {
  workspaceId?: string;
  cwd: string;
}

export interface WorkspaceScopedInput {
  workspaceId: string;
}

export interface NodeScopedInput extends WorkspaceScopedInput {
  nodeId: string;
}

export interface LocalWorkspaceNodeQueryService {
  resolveWorkspaceId: (input: ResolveWorkspaceIdInput) => string;
  getWorkspaceInfo: (input: WorkspaceScopedInput) => WorkspaceInfoResponse;
  listNodes: (input: WorkspaceScopedInput) => GraphNodeListResponse;
  getNode: (input: NodeScopedInput) => GraphNodeGetResponse;
  getNodeNeighbors: (input: NodeScopedInput) => GraphNodeNeighborsResponse;
  readNode: (input: NodeScopedInput & { mode?: string }) => GraphNodeReadResponse;
  runNodeAction: (input: NodeScopedInput & { action: string; payload?: Record<string, unknown> }) => GraphNodeActionResponse;
  close: () => void;
}

export interface CreateLocalWorkspaceNodeQueryServiceOptions {
  registryDbFilePath: string;
  workspaceDbDir: string;
  componentActionDispatcher?: ComponentActionDispatcher;
}

const toWorkspaceDbFileName = (workspaceId: string): string => {
  return workspaceId.replace(/[^a-zA-Z0-9_-]/g, '_');
};

const ensureWorkspacePath = (value: string): string => {
  return fs.existsSync(value) ? fs.realpathSync(value) : path.resolve(value);
};

const isWithinRoot = (targetPath: string, rootDir: string): boolean => {
  if (targetPath === rootDir) {
    return true;
  }
  return targetPath.startsWith(`${rootDir}${path.sep}`);
};

const createNodeNotFoundError = (): Error => new Error('NODE_NOT_FOUND');
const createWorkspaceNotFoundForCwdError = (): Error => new Error('WORKSPACE_NOT_FOUND_FOR_CWD');
const createWorkspaceNotFoundError = (workspaceId: string): Error =>
  new Error(`Workspace not found: ${workspaceId}`);

export const createLocalWorkspaceNodeQueryService = (
  options: CreateLocalWorkspaceNodeQueryServiceOptions
): LocalWorkspaceNodeQueryService => {
  const registry: RegistryRepository = createRegistryRepository({
    dbFilePath: options.registryDbFilePath
  });
  const repositories = new Map<string, WorkspaceRepository>();
  const componentActionDispatcher =
    options.componentActionDispatcher ?? createDefaultComponentActionDispatcher();

  const getWorkspaceRepository = (workspaceId: string): WorkspaceRepository => {
    const existing = repositories.get(workspaceId);
    if (existing) {
      return existing;
    }
    const repository = createWorkspaceRepository({
      dbFilePath: path.join(options.workspaceDbDir, `${toWorkspaceDbFileName(workspaceId)}.db`)
    });
    repositories.set(workspaceId, repository);
    return repository;
  };

  const getWorkspaceOrThrow = (workspaceId: string) => {
    if (!registry.hasWorkspace(workspaceId)) {
      throw createWorkspaceNotFoundError(workspaceId);
    }
    return registry.getWorkspace(workspaceId);
  };

  const toNodeRecord = (node: ReturnType<WorkspaceRepository['loadGraphSnapshot']>['nodes'][number]): GraphNodeRecord => {
    return {
      id: node.id,
      componentType: node.componentType,
      componentVersion: node.componentVersion,
      title: node.title,
      bounds: {
        x: node.bounds.x,
        y: node.bounds.y,
        width: node.bounds.width,
        height: node.bounds.height
      },
      config: node.config,
      state: node.state,
      capabilities: node.capabilities
    };
  };

  const resolveNode = (
    workspaceId: string,
    nodeId: string
  ): {
    repository: WorkspaceRepository;
    graph: ReturnType<WorkspaceRepository['loadGraphSnapshot']>;
    node: ReturnType<WorkspaceRepository['loadGraphSnapshot']>['nodes'][number];
  } => {
    getWorkspaceOrThrow(workspaceId);
    const repository = getWorkspaceRepository(workspaceId);
    const graph = repository.loadGraphSnapshot();
    const node = graph.nodes.find((item) => item.id === nodeId);
    if (!node) {
      throw createNodeNotFoundError();
    }
    return { repository, graph, node };
  };

  return {
    resolveWorkspaceId: (input: ResolveWorkspaceIdInput): string => {
      if (input.workspaceId) {
        getWorkspaceOrThrow(input.workspaceId);
        return input.workspaceId;
      }

      const cwdPath = ensureWorkspacePath(input.cwd);
      const workspace = registry
        .listWorkspaces()
        .filter((candidate) => isWithinRoot(cwdPath, candidate.rootDir))
        .sort((left, right) => right.rootDir.length - left.rootDir.length)[0];

      if (!workspace) {
        throw createWorkspaceNotFoundForCwdError();
      }

      return workspace.id;
    },
    getWorkspaceInfo: (input: WorkspaceScopedInput): WorkspaceInfoResponse => {
      const workspace = getWorkspaceOrThrow(input.workspaceId);
      const graph = getWorkspaceRepository(workspace.id).loadGraphSnapshot();
      return {
        workspaceId: workspace.id,
        name: workspace.name,
        rootDir: workspace.rootDir,
        graphSchemaVersion: graph.schemaVersion,
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length
      };
    },
    listNodes: (input: WorkspaceScopedInput): GraphNodeListResponse => {
      getWorkspaceOrThrow(input.workspaceId);
      const graph = getWorkspaceRepository(input.workspaceId).loadGraphSnapshot();
      return {
        nodes: graph.nodes.map((node) => ({
          id: node.id,
          title: node.title,
          componentType: node.componentType,
          componentVersion: node.componentVersion,
          capabilities: node.capabilities
        }))
      };
    },
    getNode: (input: NodeScopedInput): GraphNodeGetResponse => {
      const { node } = resolveNode(input.workspaceId, input.nodeId);
      return { node: toNodeRecord(node) };
    },
    getNodeNeighbors: (input: NodeScopedInput): GraphNodeNeighborsResponse => {
      getWorkspaceOrThrow(input.workspaceId);
      const graph = getWorkspaceRepository(input.workspaceId).loadGraphSnapshot();
      const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
      if (!nodeMap.has(input.nodeId)) {
        throw createNodeNotFoundError();
      }

      const upstream: GraphNodeNeighborsResponse['upstream'] = [];
      const downstream: GraphNodeNeighborsResponse['downstream'] = [];

      for (const edge of graph.edges) {
        let neighborNodeId: string | null = null;
        let neighborTitle = '';
        let neighborComponentType = '';

        if (edge.source === input.nodeId) {
          const targetNode = nodeMap.get(edge.target);
          if (targetNode) {
            neighborNodeId = targetNode.id;
            neighborTitle = targetNode.title;
            neighborComponentType = targetNode.componentType;
          }
        } else if (edge.target === input.nodeId) {
          const sourceNode = nodeMap.get(edge.source);
          if (sourceNode) {
            neighborNodeId = sourceNode.id;
            neighborTitle = sourceNode.title;
            neighborComponentType = sourceNode.componentType;
          }
        }

        if (!neighborNodeId) continue;

        const neighborEntry = {
          edgeId: edge.id,
          nodeId: neighborNodeId,
          componentType: neighborComponentType,
          title: neighborTitle
        };

        upstream.push(neighborEntry);
        downstream.push(neighborEntry);
      }

      return {
        nodeId: input.nodeId,
        upstream,
        downstream
      };
    },
    readNode: (input): GraphNodeReadResponse => {
      const { repository, graph, node } = resolveNode(input.workspaceId, input.nodeId);
      const workspace = getWorkspaceOrThrow(input.workspaceId);
      return componentActionDispatcher.read(
        {
          workspaceId: input.workspaceId,
          workspaceRootDir: workspace.rootDir,
          graph,
          node,
          saveGraph: (nextGraph) => {
            repository.saveGraphSnapshot(nextGraph);
          }
        },
        { mode: input.mode }
      );
    },
    runNodeAction: (input): GraphNodeActionResponse => {
      const { repository, graph, node } = resolveNode(input.workspaceId, input.nodeId);
      const workspace = getWorkspaceOrThrow(input.workspaceId);
      return componentActionDispatcher.action(
        {
          workspaceId: input.workspaceId,
          workspaceRootDir: workspace.rootDir,
          graph,
          node,
          saveGraph: (nextGraph) => {
            repository.saveGraphSnapshot(nextGraph);
          },
          enqueueTerminalDispatch: (dispatchInput) => {
            repository.enqueueTerminalDispatch({
              id: crypto.randomUUID(),
              workspaceId: dispatchInput.workspaceId,
              targetNodeId: dispatchInput.targetNodeId,
              action: dispatchInput.action,
              inputText: dispatchInput.inputText
            });
          }
        },
        {
          action: input.action,
          payload: input.payload
        }
      );
    },
    close: (): void => {
      for (const repository of repositories.values()) {
        repository.close();
      }
      repositories.clear();
      registry.close();
    }
  };
};
