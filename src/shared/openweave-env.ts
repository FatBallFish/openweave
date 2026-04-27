export const OPENWEAVE_ENV_KEYS = {
  workspaceId: 'OPENWEAVE_WORKSPACE_ID',
  nodeId: 'OPENWEAVE_NODE_ID',
  terminalNodeId: 'OPENWEAVE_TERMINAL_NODE_ID',
  workspaceRoot: 'OPENWEAVE_WORKSPACE_ROOT',
  terminalWorkingDir: 'OPENWEAVE_TERMINAL_WORKING_DIR'
} as const;

const readEnvValue = (env: NodeJS.ProcessEnv, key: string): string | undefined => {
  const value = env[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export interface OpenWeaveTerminalIdentityInput {
  workspaceId: string;
  nodeId: string;
  workspaceRootDir?: string;
  workingDir?: string;
}

export const buildOpenWeaveTerminalIdentityEnv = (
  input: OpenWeaveTerminalIdentityInput
): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {
    [OPENWEAVE_ENV_KEYS.workspaceId]: input.workspaceId,
    [OPENWEAVE_ENV_KEYS.nodeId]: input.nodeId,
    [OPENWEAVE_ENV_KEYS.terminalNodeId]: input.nodeId
  };

  if (typeof input.workspaceRootDir === 'string' && input.workspaceRootDir.trim().length > 0) {
    env[OPENWEAVE_ENV_KEYS.workspaceRoot] = input.workspaceRootDir;
  }
  if (typeof input.workingDir === 'string' && input.workingDir.trim().length > 0) {
    env[OPENWEAVE_ENV_KEYS.terminalWorkingDir] = input.workingDir;
  }

  return env;
};

export const resolveOpenWeaveWorkspaceIdFromEnv = (
  env: NodeJS.ProcessEnv = process.env
): string | undefined => {
  return readEnvValue(env, OPENWEAVE_ENV_KEYS.workspaceId);
};

export const resolveOpenWeaveNodeIdFromEnv = (
  env: NodeJS.ProcessEnv = process.env
): string | undefined => {
  return (
    readEnvValue(env, OPENWEAVE_ENV_KEYS.nodeId) ??
    readEnvValue(env, OPENWEAVE_ENV_KEYS.terminalNodeId)
  );
};
