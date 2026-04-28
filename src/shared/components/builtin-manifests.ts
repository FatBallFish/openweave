import type { ComponentManifestV1 } from './manifest';
import { componentManifestSchemaV1 } from './manifest';

const sharedEntry = {
  renderer: 'renderer/index.js',
  worker: 'worker/index.js'
};

const sharedCompatibility = {
  openweave: '>=0.1.0'
};

const createBuiltinManifest = (manifest: Omit<ComponentManifestV1, 'manifestVersion' | 'kind' | 'entry' | 'compatibility'>): ComponentManifestV1 => {
  return componentManifestSchemaV1.parse({
    manifestVersion: 1,
    kind: 'builtin',
    entry: sharedEntry,
    compatibility: sharedCompatibility,
    ...manifest
  });
};

export const builtinComponentManifests: ComponentManifestV1[] = [
  createBuiltinManifest({
    name: 'builtin.note',
    version: '1.0.0',
    displayName: 'Note',
    category: 'workspace',
    description: 'Markdown note surface.',
    node: {
      defaultTitle: 'Note',
      defaultSize: {
        width: 320,
        height: 240
      },
      connectable: true
    },
    schema: {
      config: {
        mode: 'markdown'
      },
      state: {
        content: '',
        viewMode: 'edit',
        backgroundColor: '#fef3c7',
        opacity: 0.7,
        fontSize: 10
      }
    },
    capabilities: ['read', 'write'],
    actions: [],
    permissions: {
      fs: 'write',
      network: 'none',
      process: 'none'
    }
  }),
  createBuiltinManifest({
    name: 'builtin.terminal',
    version: '1.0.0',
    displayName: 'Terminal',
    category: 'workspace',
    description: 'Interactive runtime terminal surface.',
    node: {
      defaultTitle: 'Terminal',
      defaultSize: {
        width: 520,
        height: 320
      },
      connectable: true
    },
    schema: {
      config: {
        command: 'echo hello',
        runtime: 'shell',
        workingDir: '',
        iconKey: '',
        iconColor: '',
        theme: 'auto',
        fontFamily: '',
        fontSize: 14,
        roleId: null
      },
      state: {
        activeSessionId: null
      }
    },
    capabilities: ['read', 'write', 'execute', 'stream'],
    actions: [],
    permissions: {
      fs: 'write',
      network: 'outbound',
      process: 'spawn'
    }
  }),
  createBuiltinManifest({
    name: 'builtin.file-tree',
    version: '1.0.0',
    displayName: 'File tree',
    category: 'workspace',
    description: 'Workspace file tree surface.',
    node: {
      defaultTitle: 'File tree',
      defaultSize: {
        width: 360,
        height: 280
      },
      connectable: false
    },
    schema: {
      config: {
        rootDir: ''
      },
      state: {}
    },
    capabilities: ['read', 'listChildren'],
    actions: [],
    permissions: {
      fs: 'read',
      network: 'none',
      process: 'none'
    }
  }),
  createBuiltinManifest({
    name: 'builtin.portal',
    version: '1.0.0',
    displayName: 'Portal',
    category: 'workspace',
    description: 'Browser portal surface.',
    node: {
      defaultTitle: 'Portal',
      defaultSize: {
        width: 420,
        height: 320
      },
      connectable: true
    },
    schema: {
      config: {
        url: 'https://example.com'
      },
      state: {}
    },
    capabilities: ['navigate', 'capture', 'input'],
    actions: [],
    permissions: {
      fs: 'none',
      network: 'outbound',
      process: 'none'
    }
  }),
  createBuiltinManifest({
    name: 'builtin.text',
    version: '1.0.0',
    displayName: 'Text',
    category: 'workspace',
    description: 'Read-only text surface.',
    node: {
      defaultTitle: 'Text',
      defaultSize: {
        width: 320,
        height: 220
      },
      connectable: false
    },
    schema: {
      config: {
        mode: 'plain'
      },
      state: {
        content: ''
      }
    },
    capabilities: ['read'],
    actions: [],
    permissions: {
      fs: 'none',
      network: 'none',
      process: 'none'
    }
  }),
  createBuiltinManifest({
    name: 'builtin.attachment',
    version: '1.0.0',
    displayName: 'Attachment',
    category: 'workspace',
    description: 'Attachment list surface.',
    node: {
      defaultTitle: 'Attachment',
      defaultSize: {
        width: 360,
        height: 240
      },
      connectable: true
    },
    schema: {
      config: {},
      state: {
        attachments: []
      }
    },
    capabilities: ['read'],
    actions: [],
    permissions: {
      fs: 'read',
      network: 'none',
      process: 'none'
    }
  })
];

const builtinComponentManifestMap = new Map(
  builtinComponentManifests.map((manifest) => [manifest.name, manifest])
);

export const getBuiltinComponentManifest = (componentType: string): ComponentManifestV1 | null => {
  return builtinComponentManifestMap.get(componentType) ?? null;
};
