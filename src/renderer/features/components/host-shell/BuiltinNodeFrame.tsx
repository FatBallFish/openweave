import type { ReactNode } from 'react';
import { BuiltinNodeFooter } from './BuiltinNodeFooter';
import { BuiltinNodeHeader } from './BuiltinNodeHeader';
import type { BuiltinNodeState } from './node-state';

interface BuiltinNodeFrameProps {
  nodeId: string;
  title: string;
  subtitle: string;
  iconLabel: string;
  state: BuiltinNodeState;
  stateLabel: string;
  footer: string | string[];
  actions?: string[];
  children: ReactNode;
}

export const BuiltinNodeFrame = ({
  nodeId,
  title,
  subtitle,
  iconLabel,
  state,
  stateLabel,
  footer,
  actions,
  children
}: BuiltinNodeFrameProps): JSX.Element => {
  return (
    <article
      className="ow-builtin-node-frame"
      data-node-state={state}
      data-testid={`builtin-node-frame-${nodeId}`}
    >
      <BuiltinNodeHeader
        nodeId={nodeId}
        title={title}
        subtitle={subtitle}
        iconLabel={iconLabel}
        state={state}
        stateLabel={stateLabel}
        actions={actions}
      />
      <div className="ow-builtin-node-frame__body">{children}</div>
      <BuiltinNodeFooter nodeId={nodeId} items={Array.isArray(footer) ? footer : [footer]} />
    </article>
  );
};
