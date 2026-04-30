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
const URL_SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//;

const shouldDefaultHttpsProtocol = (value: string): boolean => {
  return (
    value.includes('.') ||
    value.startsWith('localhost') ||
    /^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:\/|$)/.test(value)
  );
};

export const assertPortalUrlAllowed = (inputUrl: string): string => {
  const trimmed = inputUrl.trim();
  if (trimmed.length === 0) {
    throw new Error('Portal URL is required');
  }

  const candidateUrl = URL_SCHEME_PATTERN.test(trimmed)
    ? trimmed
    : shouldDefaultHttpsProtocol(trimmed)
      ? `https://${trimmed}`
      : trimmed;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(candidateUrl);
  } catch {
    throw new Error('Portal URL is invalid');
  }

  if (!ALLOWED_PROTOCOLS.has(parsedUrl.protocol)) {
    throw new Error('URL scheme not allowed');
  }
  // MVP allowlist intentionally keeps remote http/https reachable; file:// stays blocked.

  if (parsedUrl.hostname.length === 0) {
    throw new Error('Portal URL host is required');
  }

  return parsedUrl.toString();
};
