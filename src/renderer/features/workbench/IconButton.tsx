import type { ReactNode } from 'react';

interface IconButtonProps {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  testId?: string;
}

export const IconButton = ({
  label,
  icon,
  onClick,
  disabled = false,
  primary = false,
  testId
}: IconButtonProps): JSX.Element => {
  return (
    <button
      aria-label={label}
      className={`ow-icon-button${primary ? ' ow-icon-button--primary' : ''}`}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <span aria-hidden="true" className="ow-icon-button__glyph">
        {icon}
      </span>
    </button>
  );
};
