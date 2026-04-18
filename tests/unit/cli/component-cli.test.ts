import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ComponentInstallResponse,
  ComponentListResponse,
  ComponentUninstallResponse
} from '../../../src/shared/ipc/contracts';
import type { CliComponentService } from '../../../src/cli/commands/component';
import {
  createCliComponentService,
  resolveDefaultCliAppVersion
} from '../../../src/cli/commands/component';
import { runCli } from '../../../src/cli/index';

const createManifest = (overrides: Record<string, unknown> = {}) => ({
  manifestVersion: 1,
  name: 'external.note',
  version: '1.0.0',
  displayName: 'External Note',
  category: 'knowledge',
  kind: 'external',
  description: 'External note component',
  entry: {
    renderer: 'renderer/index.js',
    worker: 'worker/index.js'
  },
  node: {
    defaultTitle: 'Note',
    defaultSize: {
      width: 320,
      height: 240
    }
  },
  schema: {
    config: {
      type: 'object'
    },
    state: {
      type: 'object'
    }
  },
  capabilities: ['read'],
  actions: [
    {
      name: 'read',
      description: 'Read note',
      inputSchema: 'schemas/action.read.input.json',
      outputSchema: 'schemas/action.read.output.json',
      idempotent: true
    }
  ],
  permissions: {
    fs: 'none',
    network: 'none',
    process: 'none'
  },
  compatibility: {
    openweave: '>=0.1.0',
    platforms: [process.platform]
  },
  ...overrides
});

const createComponentPackage = (rootDir: string, overrides: Record<string, unknown> = {}): string => {
  fs.mkdirSync(path.join(rootDir, 'renderer'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'worker'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'renderer', 'index.js'), 'export default {}\n');
  fs.writeFileSync(path.join(rootDir, 'worker', 'index.js'), 'export default {}\n');
  fs.writeFileSync(path.join(rootDir, 'component.json'), JSON.stringify(createManifest(overrides), null, 2));
  return rootDir;
};

const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

const computeCrc32 = (input: Buffer): number => {
  let value = 0xffffffff;
  for (const byte of input) {
    value = crc32Table[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
};

const createZipArchive = async (sourceDir: string, zipPath: string): Promise<void> => {
  const files = fs
    .readdirSync(sourceDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.parentPath ? path.join(entry.parentPath, entry.name) : path.join(sourceDir, entry.name))
    .sort((left, right) => left.localeCompare(right));

  const localRecords: Buffer[] = [];
  const centralRecords: Buffer[] = [];
  let offset = 0;

  for (const absolutePath of files) {
    const relativePath = path.relative(sourceDir, absolutePath).split(path.sep).join('/');
    const nameBuffer = Buffer.from(relativePath, 'utf8');
    const contentBuffer = fs.readFileSync(absolutePath);
    const crc32 = computeCrc32(contentBuffer);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc32, 14);
    localHeader.writeUInt32LE(contentBuffer.length, 18);
    localHeader.writeUInt32LE(contentBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localRecord = Buffer.concat([localHeader, nameBuffer, contentBuffer]);
    localRecords.push(localRecord);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc32, 16);
    centralHeader.writeUInt32LE(contentBuffer.length, 20);
    centralHeader.writeUInt32LE(contentBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    const centralRecord = Buffer.concat([centralHeader, nameBuffer]);
    centralRecords.push(centralRecord);
    offset += localRecord.length;
  }

  const centralDirectory = Buffer.concat(centralRecords);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(centralRecords.length, 8);
  endOfCentralDirectory.writeUInt16LE(centralRecords.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  fs.writeFileSync(zipPath, Buffer.concat([...localRecords, centralDirectory, endOfCentralDirectory]));
};

const createStdStreams = () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    writeStdout: (value: string) => {
      stdout.push(value);
    },
    writeStderr: (value: string) => {
      stderr.push(value);
    }
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runCli component commands', () => {
  it('prints enabled components in concise text mode', async () => {
    const service: CliComponentService = {
      list: vi.fn(async (): Promise<ComponentListResponse> => ({
        components: [
          {
            name: 'external.note',
            version: '1.0.0',
            kind: 'external',
            displayName: 'External Note',
            category: 'knowledge',
            capabilities: ['read'],
            installed: true,
            builtin: false
          }
        ]
      })),
      installFromDirectory: vi.fn(),
      installFromZip: vi.fn(),
      uninstall: vi.fn()
    };
    const streams = createStdStreams();

    const exitCode = await runCli(['component', 'list'], {
      componentService: service,
      stdout: { write: streams.writeStdout },
      stderr: { write: streams.writeStderr }
    });

    expect(exitCode).toBe(0);
    expect(streams.stdout.join('')).toBe('external.note@1.0.0 External Note [external/knowledge] caps=read\n');
    expect(streams.stderr.join('')).toBe('');
  });

  it('prints stable JSON for list/install/uninstall commands', async () => {
    const listResponse: ComponentListResponse = {
      components: [
        {
          name: 'external.note',
          version: '1.0.0',
          kind: 'external',
          displayName: 'External Note',
          category: 'knowledge',
          capabilities: ['read'],
          installed: true,
          builtin: false
        }
      ]
    };
    const installResponse: ComponentInstallResponse = {
      component: {
        componentId: 'external.note@1.0.0',
        name: 'external.note',
        version: '1.0.0',
        sourceType: 'directory',
        installRoot: '/tmp/components/external.note/1.0.0'
      }
    };
    const uninstallResponse: ComponentUninstallResponse = {
      name: 'external.note',
      version: '1.0.0',
      uninstalled: true,
      fallbackRequired: false
    };
    const service: CliComponentService = {
      list: vi.fn(async () => listResponse),
      installFromDirectory: vi.fn(async () => installResponse),
      installFromZip: vi.fn(async () => ({
        component: {
          ...installResponse.component,
          sourceType: 'zip'
        }
      })),
      uninstall: vi.fn(async () => uninstallResponse)
    };

    const listStreams = createStdStreams();
    const listExitCode = await runCli(['component', 'list', '--json'], {
      componentService: service,
      stdout: { write: listStreams.writeStdout },
      stderr: { write: listStreams.writeStderr }
    });

    const installStreams = createStdStreams();
    const installExitCode = await runCli(['component', 'install', '--dir', '/tmp/source', '--json'], {
      componentService: service,
      stdout: { write: installStreams.writeStdout },
      stderr: { write: installStreams.writeStderr }
    });

    const uninstallStreams = createStdStreams();
    const uninstallExitCode = await runCli(['component', 'uninstall', 'external.note@1.0.0', '--json'], {
      componentService: service,
      stdout: { write: uninstallStreams.writeStdout },
      stderr: { write: uninstallStreams.writeStderr }
    });

    expect(listExitCode).toBe(0);
    expect(JSON.parse(listStreams.stdout.join(''))).toEqual(listResponse);
    expect(installExitCode).toBe(0);
    expect(JSON.parse(installStreams.stdout.join(''))).toEqual(installResponse);
    expect(uninstallExitCode).toBe(0);
    expect(JSON.parse(uninstallStreams.stdout.join(''))).toEqual(uninstallResponse);
  });

  it('rejects invalid install flag combinations with a concise error', async () => {
    const service: CliComponentService = {
      list: vi.fn(),
      installFromDirectory: vi.fn(),
      installFromZip: vi.fn(),
      uninstall: vi.fn()
    };
    const streams = createStdStreams();

    const exitCode = await runCli(['component', 'install', '--dir', '/tmp/a', '--zip', '/tmp/b'], {
      componentService: service,
      stdout: { write: streams.writeStdout },
      stderr: { write: streams.writeStderr }
    });

    expect(exitCode).toBe(1);
    expect(streams.stdout.join('')).toBe('');
    expect(streams.stderr.join('')).toBe('Specify exactly one of --dir or --zip\n');
    expect(service.installFromDirectory).not.toHaveBeenCalled();
    expect(service.installFromZip).not.toHaveBeenCalled();
  });

  it('rejects install flags without usable values', async () => {
    const service: CliComponentService = {
      list: vi.fn(),
      installFromDirectory: vi.fn(),
      installFromZip: vi.fn(),
      uninstall: vi.fn()
    };

    const missingValueStreams = createStdStreams();
    const missingValueExitCode = await runCli(['component', 'install', '--dir'], {
      componentService: service,
      stdout: { write: missingValueStreams.writeStdout },
      stderr: { write: missingValueStreams.writeStderr }
    });

    const flagValueStreams = createStdStreams();
    const flagValueExitCode = await runCli(['component', 'install', '--dir', '--json'], {
      componentService: service,
      stdout: { write: flagValueStreams.writeStdout },
      stderr: { write: flagValueStreams.writeStderr }
    });

    expect(missingValueExitCode).toBe(1);
    expect(missingValueStreams.stderr.join('')).toBe('Missing value for --dir\n');
    expect(flagValueExitCode).toBe(1);
    expect(flagValueStreams.stderr.join('')).toBe('Missing value for --dir\n');
    expect(service.installFromDirectory).not.toHaveBeenCalled();
    expect(service.installFromZip).not.toHaveBeenCalled();
  });

  it('rejects relative install paths before invoking the component service', async () => {
    const service: CliComponentService = {
      list: vi.fn(),
      installFromDirectory: vi.fn(),
      installFromZip: vi.fn(),
      uninstall: vi.fn()
    };
    const streams = createStdStreams();

    const exitCode = await runCli(['component', 'install', '--zip', 'relative/component.zip'], {
      componentService: service,
      stdout: { write: streams.writeStdout },
      stderr: { write: streams.writeStderr }
    });

    expect(exitCode).toBe(1);
    expect(streams.stderr.join('')).toBe('Install path for --zip must be absolute\n');
    expect(service.installFromDirectory).not.toHaveBeenCalled();
    expect(service.installFromZip).not.toHaveBeenCalled();
  });
});

describe('createCliComponentService', () => {
  it('reads the default app version from package metadata relative to the CLI module', () => {
    const cwdWithoutPackage = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-cli-version-cwd-'));
    const previousCwd = process.cwd();
    const readFileSync = vi.spyOn(fs, 'readFileSync');

    process.chdir(cwdWithoutPackage);
    try {
      expect(resolveDefaultCliAppVersion()).toBe('0.1.0');
      expect(readFileSync).toHaveBeenCalled();
      expect(String(readFileSync.mock.calls[0]?.[0])).toContain(`${path.sep}package.json`);
      expect(String(readFileSync.mock.calls[0]?.[0])).not.toContain(cwdWithoutPackage);
    } finally {
      process.chdir(previousCwd);
    }
  });

  it('uses the current component registry and installer abstractions via env-backed paths', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-cli-component-'));
    const sourceDir = createComponentPackage(path.join(tempDir, 'source-dir'));
    const sourceZipDir = createComponentPackage(path.join(tempDir, 'source-zip'), {
      name: 'external.whiteboard',
      version: '2.0.0',
      displayName: 'External Whiteboard'
    });
    const zipPath = path.join(tempDir, 'component.zip');
    await createZipArchive(sourceZipDir, zipPath);

    const service = createCliComponentService({
      env: {
        OPENWEAVE_APP_VERSION: '0.1.0',
        OPENWEAVE_REGISTRY_DB_PATH: path.join(tempDir, 'registry.sqlite'),
        OPENWEAVE_COMPONENT_INSTALL_ROOT: path.join(tempDir, 'installed-components')
      }
    });

    const firstInstall = await service.installFromDirectory(sourceDir);
    const secondInstall = await service.installFromZip(zipPath);
    const listed = await service.list();
    const uninstalled = await service.uninstall('external.note', '1.0.0');
    const listedAfterUninstall = await service.list();

    expect(firstInstall.component).toMatchObject({
      componentId: 'external.note@1.0.0',
      sourceType: 'directory'
    });
    expect(secondInstall.component).toMatchObject({
      componentId: 'external.whiteboard@2.0.0',
      sourceType: 'zip'
    });
    expect(listed.components.map((component) => component.name)).toEqual([
      'external.note',
      'external.whiteboard'
    ]);
    expect(uninstalled).toEqual({
      name: 'external.note',
      version: '1.0.0',
      uninstalled: true,
      fallbackRequired: true
    });
    expect(listedAfterUninstall.components.map((component) => component.name)).toEqual(['external.whiteboard']);
  });

  it('passes a stable app version without relying on process.cwd package metadata', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-cli-version-'));
    const cwdWithoutPackage = fs.mkdtempSync(path.join(os.tmpdir(), 'openweave-cli-cwd-'));
    const sourceDir = createComponentPackage(path.join(tempDir, 'source-dir'));
    const previousCwd = process.cwd();

    process.chdir(cwdWithoutPackage);
    try {
      const service = createCliComponentService({
        env: {
          OPENWEAVE_REGISTRY_DB_PATH: path.join(tempDir, 'registry.sqlite'),
          OPENWEAVE_COMPONENT_INSTALL_ROOT: path.join(tempDir, 'installed-components')
        }
      });

      await expect(service.installFromDirectory(sourceDir)).resolves.toMatchObject({
        component: {
          componentId: 'external.note@1.0.0'
        }
      });
    } finally {
      process.chdir(previousCwd);
    }
  });
});
