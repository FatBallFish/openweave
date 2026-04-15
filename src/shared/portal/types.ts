export interface PortalSessionRecord {
  id: string;
  workspaceId: string;
  nodeId: string;
  url: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface PortalScreenshotResult {
  path: string;
  takenAtMs: number;
}

export interface PortalStructureElement {
  tag: string;
  text: string;
  id?: string;
  role?: string;
}

export interface PortalStructureResult {
  elements: PortalStructureElement[];
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export const assertPortalUrlAllowed = (inputUrl: string): string => {
  const trimmed = inputUrl.trim();
  if (trimmed.length === 0) {
    throw new Error('Portal URL is required');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    throw new Error('Portal URL is invalid');
  }

  if (!ALLOWED_PROTOCOLS.has(parsedUrl.protocol)) {
    throw new Error('URL scheme not allowed');
  }

  if (parsedUrl.hostname.length === 0) {
    throw new Error('Portal URL host is required');
  }

  return parsedUrl.toString();
};
