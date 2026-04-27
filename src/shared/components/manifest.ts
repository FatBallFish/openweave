import { z } from 'zod';

const componentNamePattern =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/;
const componentVersionPattern =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const componentActionNamePattern = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

const isSafeComponentEntryPath = (value: string): boolean => {
  if (value === '') {
    return true;
  }

  if (/^(?:[A-Za-z]:[\\/]|\/|\\\\)/.test(value)) {
    return false;
  }

  return !value.split(/[\\/]+/).some((segment) => segment === '..');
};

export const componentCapabilityValues = [
  'read',
  'write',
  'listChildren',
  'create',
  'update',
  'delete',
  'execute',
  'navigate',
  'capture',
  'input',
  'stream'
] as const;

export const componentCapabilitySchema = z.enum(componentCapabilityValues);

export const componentNameSchema = z
  .string()
  .trim()
  .min(1)
  .regex(componentNamePattern, 'Component name must be dot-separated lowercase segments');

export const componentVersionSchema = z
  .string()
  .trim()
  .min(1)
  .regex(componentVersionPattern, 'Component version must use semver');

export const componentEntryPathSchema = z
  .string()
  .trim()
  .min(1, 'Entry path is required')
  .refine(isSafeComponentEntryPath, 'Entry path must stay within the component package');

export const componentActionManifestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .regex(componentActionNamePattern, 'Action name contains unsupported characters'),
  description: z.string().trim().min(1),
  inputSchema: z.string().trim().min(1),
  outputSchema: z.string().trim().min(1),
  idempotent: z.boolean()
});

const componentSizeSchema = z.object({
  width: z.number().finite().gt(0),
  height: z.number().finite().gt(0)
});

export const componentManifestSchemaV1 = z
  .object({
    manifestVersion: z.literal(1),
    name: componentNameSchema,
    version: componentVersionSchema,
    displayName: z.string().trim().min(1),
    category: z.string().trim().min(1),
    kind: z.enum(['builtin', 'external']),
    description: z.string().trim().min(1).optional(),
    entry: z.object({
      renderer: componentEntryPathSchema,
      worker: componentEntryPathSchema
    }),
    node: z.object({
      defaultTitle: z.string().trim().min(1),
      defaultSize: componentSizeSchema,
      minSize: componentSizeSchema.optional(),
      connectable: z.boolean().optional().default(true)
    }),
    schema: z
      .object({
        config: z.record(z.unknown()).optional(),
        state: z.record(z.unknown()).optional()
      })
      .default({}),
    capabilities: z
      .array(componentCapabilitySchema)
      .min(1)
      .refine((values) => new Set(values).size === values.length, {
        message: 'Capabilities must be unique'
      }),
    actions: z
      .array(componentActionManifestSchema)
      .refine((actions) => new Set(actions.map((action) => action.name)).size === actions.length, {
        message: 'Action names must be unique'
      }),
    permissions: z.object({
      fs: z.enum(['none', 'read', 'write']),
      network: z.enum(['none', 'outbound']),
      process: z.enum(['none', 'spawn'])
    }),
    compatibility: z.object({
      openweave: z.string().trim().min(1),
      platforms: z.array(z.enum(['darwin', 'linux', 'win32'])).optional()
    })
  })
  .superRefine((manifest, context) => {
    const { defaultSize, minSize } = manifest.node;
    if (
      minSize &&
      (minSize.width > defaultSize.width || minSize.height > defaultSize.height)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['node', 'minSize'],
        message: 'Node minimum size cannot exceed the default size'
      });
    }
  });

export type ComponentCapability = z.infer<typeof componentCapabilitySchema>;
export type ComponentActionManifest = z.infer<typeof componentActionManifestSchema>;
export type ComponentManifestV1 = z.infer<typeof componentManifestSchemaV1>;
