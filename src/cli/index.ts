#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  createCliComponentService,
  formatComponentInstallText,
  formatComponentListText,
  formatComponentUninstallText,
  type CliComponentService
} from './commands/component';
import {
  createCliWorkspaceNodeService,
  formatWorkspaceInfoText,
  type CliWorkspaceNodeService
} from './commands/workspace';
import {
  formatNodeActionText,
  formatNodeGetText,
  formatNodeListText,
  formatNodeNeighborsText,
  formatNodeReadText
} from './commands/node';

interface WritableLike {
  write: (chunk: string) => void;
}

export interface RunCliDependencies {
  stdout?: WritableLike;
  stderr?: WritableLike;
  componentService?: CliComponentService;
  workspaceNodeService?: CliWorkspaceNodeService;
  cwd?: string;
}

const writeJson = (stdout: WritableLike, payload: unknown, pretty = false): void => {
  stdout.write(`${JSON.stringify(payload, null, pretty ? 2 : 0)}\n`);
};

const splitComponentRef = (value: string): { name: string; version?: string } => {
  const separatorIndex = value.lastIndexOf('@');
  if (separatorIndex <= 0) {
    return { name: value };
  }

  return {
    name: value.slice(0, separatorIndex),
    version: value.slice(separatorIndex + 1)
  };
};

const isFlagToken = (value: string | undefined): boolean => value?.startsWith('--') === true;

const takeFlagValue = (
  args: string[],
  flag: string
): { present: boolean; value?: string; error?: string } => {
  const flagIndex = args.indexOf(flag);
  if (flagIndex === -1) {
    return { present: false };
  }
  const value = args[flagIndex + 1];
  if (!value || isFlagToken(value)) {
    return {
      present: true,
      error: `Missing value for ${flag}`
    };
  }
  return {
    present: true,
    value
  };
};

const hasFlag = (args: string[], flag: string): boolean => args.includes(flag);
const isAbsoluteInputPath = (value: string): boolean => path.isAbsolute(value) || /^(?:[A-Za-z]:[\\/]|\\\\)/.test(value);

interface ParsedGlobalOptions {
  workspaceId?: string;
  json: boolean;
  pretty: boolean;
  commandIndex: number;
  error?: string;
}

const parseLeadingGlobalOptions = (args: string[]): ParsedGlobalOptions => {
  let workspaceId: string | undefined;
  let json = false;
  let pretty = false;
  let commandIndex = 0;

  while (commandIndex < args.length) {
    const token = args[commandIndex];

    if (token === '--workspace') {
      const value = args[commandIndex + 1];
      if (!value || isFlagToken(value)) {
        return {
          workspaceId,
          json,
          pretty,
          commandIndex,
          error: 'Missing value for --workspace'
        };
      }
      workspaceId = value;
      commandIndex += 2;
      continue;
    }

    if (token === '--json') {
      json = true;
      commandIndex += 1;
      continue;
    }

    if (token === '--pretty') {
      pretty = true;
      commandIndex += 1;
      continue;
    }

    if (token === '--timeout') {
      const value = args[commandIndex + 1];
      if (!value || isFlagToken(value)) {
        return {
          workspaceId,
          json,
          pretty,
          commandIndex,
          error: 'Missing value for --timeout'
        };
      }
      commandIndex += 2;
      continue;
    }

    break;
  }

  return { workspaceId, json, pretty, commandIndex };
};

const findPositionals = (args: string[], flagsWithValue: string[]): string[] => {
  const skipValueFor = new Set(flagsWithValue);
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (skipValueFor.has(token)) {
      index += 1;
      continue;
    }
    if (token.startsWith('--')) {
      continue;
    }
    values.push(token);
  }

  return values;
};

const fail = (stderr: WritableLike, message: string): number => {
  stderr.write(`${message}\n`);
  return 1;
};

const parseJsonObject = (value: string): Record<string, unknown> => {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Input JSON must be an object');
  }
  return parsed as Record<string, unknown>;
};

export const runCli = async (argv: string[], deps: RunCliDependencies = {}): Promise<number> => {
  const stdout = deps.stdout ?? process.stdout;
  const stderr = deps.stderr ?? process.stderr;
  let componentService = deps.componentService;
  let workspaceNodeService = deps.workspaceNodeService;
  let shouldCloseWorkspaceNodeService = false;
  const cwd = deps.cwd ?? process.cwd();

  try {
    const global = parseLeadingGlobalOptions(argv);
    if (global.error) {
      return fail(stderr, global.error);
    }
    const [command, subcommand, ...rest] = argv.slice(global.commandIndex);

    if (!command) {
      return fail(stderr, 'Unknown command');
    }

    const workspaceFlag = takeFlagValue(rest, '--workspace');
    if (workspaceFlag.error) {
      return fail(stderr, workspaceFlag.error);
    }
    const workspaceIdHint = workspaceFlag.present ? workspaceFlag.value : global.workspaceId;
    const json = global.json || hasFlag(rest, '--json');
    const pretty = global.pretty || hasFlag(rest, '--pretty');

    if (command === 'workspace' || command === 'node') {
      workspaceNodeService = workspaceNodeService ?? createCliWorkspaceNodeService();
      shouldCloseWorkspaceNodeService = deps.workspaceNodeService === undefined;
    }

    if (command === 'workspace') {
      if (subcommand !== 'info') {
        return fail(stderr, 'Unknown workspace command');
      }
      if (!workspaceNodeService) {
        return fail(stderr, 'BRIDGE_UNAVAILABLE');
      }
      const workspaceId = await workspaceNodeService.resolveWorkspaceId({
        workspaceId: workspaceIdHint,
        cwd
      });
      const response = await workspaceNodeService.getWorkspaceInfo({ workspaceId });
      if (json) {
        writeJson(stdout, response, pretty);
      } else {
        stdout.write(formatWorkspaceInfoText(response));
      }
      return 0;
    }

    if (command === 'node') {
      if (!workspaceNodeService) {
        return fail(stderr, 'BRIDGE_UNAVAILABLE');
      }
      const workspaceId = await workspaceNodeService.resolveWorkspaceId({
        workspaceId: workspaceIdHint,
        cwd
      });

      if (subcommand === 'list') {
        const response = await workspaceNodeService.listNodes({ workspaceId });
        if (json) {
          writeJson(stdout, response, pretty);
        } else {
          stdout.write(formatNodeListText(response));
        }
        return 0;
      }

      if (subcommand === 'get') {
        const nodeId = findPositionals(rest, ['--workspace', '--timeout'])[0];
        if (!nodeId) {
          return fail(stderr, 'Node id is required');
        }
        const response = await workspaceNodeService.getNode({ workspaceId, nodeId });
        if (json) {
          writeJson(stdout, response, pretty);
        } else {
          stdout.write(formatNodeGetText(response));
        }
        return 0;
      }

      if (subcommand === 'neighbors') {
        const nodeId = findPositionals(rest, ['--workspace', '--timeout'])[0];
        if (!nodeId) {
          return fail(stderr, 'Node id is required');
        }
        const response = await workspaceNodeService.getNodeNeighbors({ workspaceId, nodeId });
        if (json) {
          writeJson(stdout, response, pretty);
        } else {
          stdout.write(formatNodeNeighborsText(response));
        }
        return 0;
      }

      if (subcommand === 'read') {
        const nodeId = findPositionals(rest, ['--workspace', '--timeout', '--mode'])[0];
        if (!nodeId) {
          return fail(stderr, 'Node id is required');
        }
        const modeFlag = takeFlagValue(rest, '--mode');
        if (modeFlag.error) {
          return fail(stderr, modeFlag.error);
        }
        const response = await workspaceNodeService.readNode({
          workspaceId,
          nodeId,
          mode: modeFlag.value
        });
        if (json) {
          writeJson(stdout, response, pretty);
        } else {
          stdout.write(formatNodeReadText(response));
        }
        return 0;
      }

      if (subcommand === 'action') {
        const positionals = findPositionals(rest, [
          '--workspace',
          '--timeout',
          '--json-input',
          '--input-file'
        ]);
        const nodeId = positionals[0];
        const action = positionals[1];
        if (!nodeId) {
          return fail(stderr, 'Node id is required');
        }
        if (!action) {
          return fail(stderr, 'Action is required');
        }

        const jsonInputFlag = takeFlagValue(rest, '--json-input');
        if (jsonInputFlag.error) {
          return fail(stderr, jsonInputFlag.error);
        }
        const inputFileFlag = takeFlagValue(rest, '--input-file');
        if (inputFileFlag.error) {
          return fail(stderr, inputFileFlag.error);
        }
        if (jsonInputFlag.present && inputFileFlag.present) {
          return fail(stderr, 'Specify exactly one of --json-input or --input-file');
        }

        let payload: Record<string, unknown> | undefined;
        if (jsonInputFlag.value) {
          payload = parseJsonObject(jsonInputFlag.value);
        }
        if (inputFileFlag.value) {
          payload = parseJsonObject(fs.readFileSync(inputFileFlag.value, 'utf8'));
        }

        const response = await workspaceNodeService.runNodeAction({
          workspaceId,
          nodeId,
          action,
          payload
        });
        if (json) {
          writeJson(stdout, response, pretty);
        } else {
          stdout.write(formatNodeActionText(response));
        }
        return 0;
      }

      return fail(stderr, 'Unknown node command');
    }

    if (command !== 'component') {
      return fail(stderr, 'Unknown command');
    }

    componentService = componentService ?? createCliComponentService();

    if (subcommand === 'list') {
      const response = await componentService.list();
      if (json) {
        writeJson(stdout, response, pretty);
      } else {
        stdout.write(formatComponentListText(response));
      }
      return 0;
    }

    if (subcommand === 'install') {
      const dirPath = takeFlagValue(rest, '--dir');
      const zipPath = takeFlagValue(rest, '--zip');
      if (dirPath.error) {
        return fail(stderr, dirPath.error);
      }
      if (zipPath.error) {
        return fail(stderr, zipPath.error);
      }
      if ((dirPath.present ? 1 : 0) + (zipPath.present ? 1 : 0) !== 1) {
        return fail(stderr, 'Specify exactly one of --dir or --zip');
      }
      const sourceFlag = dirPath.present ? '--dir' : '--zip';
      const sourcePath = dirPath.value ?? zipPath.value;
      if (!sourcePath || !isAbsoluteInputPath(sourcePath)) {
        return fail(stderr, `Install path for ${sourceFlag} must be absolute`);
      }

      const response = dirPath.present
        ? await componentService.installFromDirectory(sourcePath)
        : await componentService.installFromZip(sourcePath);
      if (json) {
        writeJson(stdout, response, pretty);
      } else {
        stdout.write(formatComponentInstallText(response));
      }
      return 0;
    }

    if (subcommand === 'uninstall') {
      const target = rest.find((value) => !value.startsWith('--'));
      if (!target) {
        return fail(stderr, 'Component name is required');
      }
      const parsed = splitComponentRef(target);
      const response = await componentService.uninstall(parsed.name, parsed.version);
      if (json) {
        writeJson(stdout, response, pretty);
      } else {
        stdout.write(formatComponentUninstallText(response));
      }
      return 0;
    }

    return fail(stderr, 'Unknown component command');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return fail(stderr, message);
  } finally {
    if (shouldCloseWorkspaceNodeService) {
      workspaceNodeService?.close?.();
    }
  }
};

const main = async (): Promise<void> => {
  const exitCode = await runCli(process.argv.slice(2));
  process.exitCode = exitCode;
};

if (require.main === module) {
  void main();
}
