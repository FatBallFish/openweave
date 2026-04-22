import type { CSSProperties } from 'react';

export interface WorkspaceIconOption {
  key: string;
  label: string;
  paths: string[];
}

export const DEFAULT_WORKSPACE_ICON_KEY = 'folder-stack';
export const DEFAULT_WORKSPACE_ICON_COLOR = '#64748B';

export const WORKSPACE_ICON_OPTIONS: WorkspaceIconOption[] = [
  {
    key: 'folder-stack',
    label: 'Folder stack',
    paths: ['M3 7.5h7l2 2h9v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z', 'M3 7.5V6a2 2 0 0 1 2-2h5l2 2h7']
  },
  {
    key: 'terminal',
    label: 'Terminal',
    paths: ['M4 6h16v12H4z', 'M7 10l3 2-3 2', 'M12.5 14H17']
  },
  {
    key: 'git-branch',
    label: 'Branch',
    paths: ['M8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z', 'M16 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z', 'M8 10v4a4 4 0 0 0 4 4h2', 'M16 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z', 'M8 12h4a4 4 0 0 0 4-4']
  },
  {
    key: 'compass',
    label: 'Compass',
    paths: ['M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z', 'M9 15l2.5-6.5L18 6l-2.5 6.5Z']
  },
  {
    key: 'package',
    label: 'Package',
    paths: ['M12 3.5 20 8v8l-8 4.5L4 16V8Z', 'M12 3.5v8.5', 'M4 8l8 4.5 8-4.5']
  },
  {
    key: 'server',
    label: 'Server',
    paths: ['M4 5.5h16v5H4z', 'M4 13.5h16v5H4z', 'M7.5 8h.01', 'M7.5 16h.01']
  },
  {
    key: 'star',
    label: 'Star',
    paths: ['m12 4 2.4 4.9L20 9.8l-4 3.9.9 5.5L12 16.8 7.1 19.2 8 13.7 4 9.8l5.6-.9Z']
  },
  {
    key: 'anchor',
    label: 'Anchor',
    paths: ['M12 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z', 'M12 8v10', 'M7 13H3a9 9 0 0 0 18 0h-4', 'M7 13a5 5 0 0 0 10 0']
  },
  {
    key: 'radar',
    label: 'Radar',
    paths: ['M12 4a8 8 0 1 0 8 8', 'M12 8a4 4 0 1 0 4 4', 'M12 12l6-6']
  },
  {
    key: 'layers',
    label: 'Layers',
    paths: ['m12 4 8 4-8 4-8-4Z', 'm4 12 8 4 8-4', 'm4 16 8 4 8-4']
  },
  {
    key: 'cube',
    label: 'Cube',
    paths: ['M12 4 19 8v8l-7 4-7-4V8Z', 'M12 12 19 8', 'M12 12 5 8', 'M12 12v8']
  },
  {
    key: 'bolt',
    label: 'Bolt',
    paths: ['M13 3 6 13h5l-1 8 8-11h-5Z']
  },
  {
    key: 'shield',
    label: 'Shield',
    paths: ['M12 3.5 19 6v5.8c0 4.3-2.7 6.9-7 8.7-4.3-1.8-7-4.4-7-8.7V6Z']
  },
  {
    key: 'cloud',
    label: 'Cloud',
    paths: ['M7 18h9a4 4 0 0 0 .6-7.9A5.5 5.5 0 0 0 6 11.5 3.5 3.5 0 0 0 7 18Z']
  },
  {
    key: 'globe',
    label: 'Globe',
    paths: ['M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z', 'M3.8 12h16.4', 'M12 3.5a12 12 0 0 1 0 17', 'M12 3.5a12 12 0 0 0 0 17']
  },
  {
    key: 'notebook',
    label: 'Notebook',
    paths: ['M6 4h10a2 2 0 0 1 2 2v12H8a2 2 0 0 0-2 2Z', 'M6 4v16', 'M10 8h5', 'M10 12h5']
  },
  {
    key: 'wrench',
    label: 'Wrench',
    paths: ['M14.5 5.5a4 4 0 0 0 3.8 5.1L11 17.9a2 2 0 0 1-2.8-2.8l7.3-7.3a4 4 0 0 0-1-2.3Z']
  },
  {
    key: 'rocket',
    label: 'Rocket',
    paths: ['M12 5c2.5 0 4.5 2 4.5 4.5v1.3L12 15.3 7.5 10.8V9.5C7.5 7 9.5 5 12 5Z', 'M12 15.3v3.2', 'M7.5 10.8H5.8', 'M18.2 10.8h-1.7']
  },
  {
    key: 'puzzle',
    label: 'Puzzle',
    paths: ['M9 4h3a2 2 0 1 1 4 0h3v5a2 2 0 1 1 0 4v5h-5a2 2 0 1 1-4 0H5v-5a2 2 0 1 1 0-4V4Z']
  },
  {
    key: 'database',
    label: 'Database',
    paths: ['M5 7c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3Z', 'M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7', 'M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5']
  },
  {
    key: 'pin',
    label: 'Pin',
    paths: ['M9 4h6l-1 5 2 2-4 1-1 8-1-8-4-1 2-2Z']
  },
  {
    key: 'command',
    label: 'Command',
    paths: ['M7 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm10 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM7 14a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm10 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z', 'M9 8h6', 'M9 16h6', 'M7 10v4', 'M17 10v4']
  },
  {
    key: 'spark',
    label: 'Spark',
    paths: ['m12 4 1.7 3.8L18 9.5l-4.3 1.7L12 15l-1.7-3.8L6 9.5l4.3-1.7Z', 'm5 4 1 2.2L8 7l-2 .8L5 10l-.9-2.2L2 7l2.1-.8Z', 'm19 14 1 2.2 2.1.8-2.1.8-1 2.2-.9-2.2-2.1-.8 2.1-.8Z']
  },
  {
    key: 'beacon',
    label: 'Beacon',
    paths: ['M12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z', 'M12 3v2', 'M12 19v2', 'M4.2 7.2l1.4 1.4', 'M18.4 15.4l1.4 1.4', 'M3 12h2', 'M19 12h2', 'M4.2 16.8l1.4-1.4', 'M18.4 8.6l1.4-1.4']
  }
];

export const WORKSPACE_COLOR_OPTIONS = [
  '#EF4444',
  '#F97316',
  '#EAB308',
  '#22C55E',
  '#06B6D4',
  '#3B82F6',
  '#EC4899'
];

const iconOptionByKey = new Map(WORKSPACE_ICON_OPTIONS.map((option) => [option.key, option]));

export const normalizeWorkspaceIconKey = (iconKey?: string | null): string => {
  if (!iconKey) {
    return DEFAULT_WORKSPACE_ICON_KEY;
  }
  return iconOptionByKey.has(iconKey) ? iconKey : DEFAULT_WORKSPACE_ICON_KEY;
};

export const normalizeWorkspaceIconColor = (iconColor?: string | null): string => {
  if (!iconColor) {
    return DEFAULT_WORKSPACE_ICON_COLOR;
  }
  return /^#[0-9a-fA-F]{6}$/.test(iconColor) ? iconColor.toUpperCase() : DEFAULT_WORKSPACE_ICON_COLOR;
};

export const resolveWorkspaceIconOption = (iconKey?: string | null): WorkspaceIconOption => {
  const normalizedKey = normalizeWorkspaceIconKey(iconKey);
  return iconOptionByKey.get(normalizedKey) ?? WORKSPACE_ICON_OPTIONS[0];
};

interface WorkspaceGlyphProps {
  iconKey?: string | null;
  color?: string | null;
  muted?: boolean;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export const WorkspaceGlyph = ({
  iconKey,
  color,
  muted = false,
  size = 18,
  className,
  style
}: WorkspaceGlyphProps): JSX.Element => {
  const iconOption = resolveWorkspaceIconOption(iconKey);
  const normalizedColor = normalizeWorkspaceIconColor(color);

  return (
    <svg
      aria-hidden="true"
      className={className}
      style={style}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={muted ? 'var(--ow-color-text-muted)' : normalizedColor}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconOption.paths.map((pathData) => (
        <path d={pathData} key={pathData} />
      ))}
    </svg>
  );
};
