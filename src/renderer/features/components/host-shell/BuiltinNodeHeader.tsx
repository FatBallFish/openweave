import type { BuiltinNodeState } from './node-state';

interface BuiltinNodeHeaderProps {
  nodeId: string;
  title: string;
  subtitle: string;
  iconLabel: string;
  state: BuiltinNodeState;
  stateLabel: string;
  actions?: string[];
}

export const BuiltinNodeHeader = ({
  nodeId,
  title,
  subtitle,
  iconLabel,
  state,
  stateLabel,
  actions = []
}: BuiltinNodeHeaderProps): JSX.Element => {
  return (
    <header
      className="ow-builtin-node-header"
      data-node-state={state}
      data-testid={`builtin-node-header-${nodeId}`}
    >
      <div className="ow-builtin-node-header__identity">
        <div aria-hidden="true" className="ow-builtin-node-header__icon">
          {iconLabel}
        </div>
        <div className="ow-builtin-node-header__copy">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
      </div>

      <div className="ow-builtin-node-header__meta">
        <span className="ow-builtin-node-header__state">{stateLabel}</span>
        {actions.length > 0 ? (
          <div className="ow-builtin-node-header__actions">
            {actions.map((action) => (
              <span key={action}>{action}</span>
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
};
