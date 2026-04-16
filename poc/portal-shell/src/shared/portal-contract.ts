export type PortalBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PortalDefinition = {
  id: string;
  label: string;
  url: string;
};

export type PortalMode = 'live' | 'fallback';

export type PortalVisualState = {
  mode: PortalMode;
  bounds: PortalBounds | null;
  fallbackDataUrl: string | null;
  syncId: number;
};

export type PortalHarnessSnapshot = {
  portals: PortalDefinition[];
  activePortalId: string;
  livePortalId: string | null;
  zoom: number;
  portalStates: Record<string, PortalVisualState>;
};
