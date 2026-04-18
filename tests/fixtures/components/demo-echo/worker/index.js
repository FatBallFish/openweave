const supportsDemoEcho = (componentType) => componentType === 'external.demo-echo';

const readContent = (node) => String(node.state?.content ?? '');

const writeContent = (context, nextContent) => {
  const nextGraph = {
    ...context.graph,
    nodes: context.graph.nodes.map((node) =>
      node.id === context.node.id
        ? {
            ...node,
            state: {
              ...node.state,
              content: nextContent
            },
            updatedAtMs: node.updatedAtMs + 1
          }
        : node
    )
  };

  context.saveGraph(nextGraph);
  return nextGraph;
};

const createDemoEchoActionAdapter = () => ({
  supports: supportsDemoEcho,
  read: (context) => ({
    nodeId: context.node.id,
    action: 'read',
    result: {
      content: readContent(context.node)
    }
  }),
  action: (context, input) => {
    if (input.action === 'write') {
      writeContent(context, String(input.payload?.content ?? ''));
      return {
        nodeId: context.node.id,
        action: 'write',
        ok: true,
        result: {
          updated: true
        }
      };
    }

    if (input.action === 'echo') {
      return {
        nodeId: context.node.id,
        action: 'echo',
        ok: true,
        result: {
          content: `${readContent(context.node)}:${String(input.payload?.suffix ?? '')}`
        }
      };
    }

    throw new Error('NODE_ACTION_NOT_SUPPORTED');
  }
});

const worker = {
  kind: 'demo-echo-worker',
  createDemoEchoActionAdapter
};

module.exports = {
  createDemoEchoActionAdapter,
  worker
};
