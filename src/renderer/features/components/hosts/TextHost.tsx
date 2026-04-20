import { BuiltinNodeFrame } from '../host-shell/BuiltinNodeFrame';
import { getBuiltinNodeStateLabel, resolveBuiltinNodeState } from '../host-shell/node-state';
import type { BuiltinHostProps } from './types';

export const TextHost = ({ node }: BuiltinHostProps): JSX.Element => {
  const content = typeof node.state.content === 'string' ? node.state.content : '';
  const state = resolveBuiltinNodeState(node);
  const lineCount = content.length === 0 ? 0 : content.split('\n').length;

  return (
    <BuiltinNodeFrame
      actions={['Copy', 'Expand']}
      footer={[`${lineCount} lines`, 'Read only', 'Pinned evidence']}
      iconLabel="TX"
      kind="text"
      nodeId={node.id}
      state={state}
      stateLabel={getBuiltinNodeStateLabel(state)}
      subtitle="Read-only output"
      title={node.title}
    >
      <div className="ow-text-host">
        <div className="ow-text-host__hint">Read only</div>
        <pre className="ow-text-host__content" data-testid={`text-host-content-${node.id}`}>
          {content || '(empty text)'}
        </pre>
      </div>
    </BuiltinNodeFrame>
  );
};
