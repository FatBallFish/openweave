import type {
  GraphNodeActionResponse,
  GraphNodeGetResponse,
  GraphNodeListResponse,
  GraphNodeNeighborsResponse,
  GraphNodeReadResponse
} from '../../shared/ipc/contracts';

const formatCapabilities = (capabilities: string[]): string => capabilities.join(',');

export const formatNodeListText = (response: GraphNodeListResponse): string => {
  if (response.nodes.length === 0) {
    return 'No nodes.\n';
  }

  return response.nodes
    .map(
      (node) =>
        `${node.id} ${node.title} [${node.componentType}@${node.componentVersion}] caps=${formatCapabilities(node.capabilities)}`
    )
    .join('\n')
    .concat('\n');
};

export const formatNodeGetText = (response: GraphNodeGetResponse): string => {
  return [
    `Node: ${response.node.id}`,
    `Title: ${response.node.title}`,
    `Component: ${response.node.componentType}@${response.node.componentVersion}`,
    `Bounds: ${response.node.bounds.x},${response.node.bounds.y} ${response.node.bounds.width}x${response.node.bounds.height}`,
    `Capabilities: ${formatCapabilities(response.node.capabilities)}`
  ].join('\n').concat('\n');
};

const formatNeighborLines = (
  title: string,
  neighbors: GraphNodeNeighborsResponse['upstream'] | GraphNodeNeighborsResponse['downstream']
): string[] => {
  if (neighbors.length === 0) {
    return [`${title}: (none)`];
  }
  return [
    `${title}:`,
    ...neighbors.map(
      (neighbor) => `- ${neighbor.nodeId} ${neighbor.title} [${neighbor.componentType}] edge=${neighbor.edgeId}`
    )
  ];
};

export const formatNodeNeighborsText = (response: GraphNodeNeighborsResponse): string => {
  return [
    `Node: ${response.nodeId}`,
    ...formatNeighborLines('Upstream', response.upstream),
    ...formatNeighborLines('Downstream', response.downstream)
  ].join('\n').concat('\n');
};

export const formatNodeReadText = (response: GraphNodeReadResponse): string => {
  return [
    `Node: ${response.nodeId}`,
    `Action: ${response.action}`,
    `Content: ${String(response.result.content ?? '')}`
  ].join('\n').concat('\n');
};

export const formatNodeActionText = (response: GraphNodeActionResponse): string => {
  return [
    `Node: ${response.nodeId}`,
    `Action: ${response.action}`,
    `OK: ${response.ok ? 'true' : 'false'}`
  ].join('\n').concat('\n');
};
