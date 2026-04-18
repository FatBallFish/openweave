import { createBuiltinAttachmentActionAdapter } from './action-adapters/builtin-attachment-action-adapter';
import { createBuiltinNoteActionAdapter } from './action-adapters/builtin-note-action-adapter';
import { createBuiltinTextActionAdapter } from './action-adapters/builtin-text-action-adapter';
import {
  createComponentActionDispatcher,
  type ComponentActionAdapter,
  type ComponentActionDispatcher
} from './component-action-dispatcher';

export type ComponentActionAdapterRegistrationSource = 'builtin' | 'external' | 'custom';

export interface RegisterComponentActionAdapterInput {
  componentType: string;
  source: ComponentActionAdapterRegistrationSource;
  adapter: ComponentActionAdapter;
}

export interface ComponentActionAdapterRegistry {
  register: (input: RegisterComponentActionAdapterInput) => void;
  createAdapters: () => ComponentActionAdapter[];
  createDispatcher: () => ComponentActionDispatcher;
}

const isBuiltinComponentType = (componentType: string): boolean => componentType.startsWith('builtin.');

const createBuiltinRegistrationCollisionError = (componentType: string): Error => {
  return new Error(`Non-builtin adapter cannot register builtin component type: ${componentType}`);
};

const createBuiltinSourceMismatchError = (componentType: string): Error => {
  return new Error(`Builtin adapter must register builtin component type: ${componentType}`);
};

const createDuplicateRegistrationError = (componentType: string): Error => {
  return new Error(`Component action adapter already registered for component type: ${componentType}`);
};

export const createComponentActionAdapterRegistry = (): ComponentActionAdapterRegistry => {
  const adaptersByComponentType = new Map<string, ComponentActionAdapter>();

  const createRegisteredAdapters = (): ComponentActionAdapter[] => {
    return Array.from(adaptersByComponentType.entries()).map(([componentType, adapter]) => ({
      supports: (candidateType) => candidateType === componentType,
      read: adapter.read,
      action: adapter.action
    }));
  };

  return {
    register: (input): void => {
      if (input.source !== 'builtin' && isBuiltinComponentType(input.componentType)) {
        throw createBuiltinRegistrationCollisionError(input.componentType);
      }
      if (input.source === 'builtin' && !isBuiltinComponentType(input.componentType)) {
        throw createBuiltinSourceMismatchError(input.componentType);
      }
      const existing = adaptersByComponentType.get(input.componentType);
      if (existing) {
        throw createDuplicateRegistrationError(input.componentType);
      }

      adaptersByComponentType.set(input.componentType, input.adapter);
    },
    createAdapters: (): ComponentActionAdapter[] => {
      return createRegisteredAdapters();
    },
    createDispatcher: (): ComponentActionDispatcher => {
      return createComponentActionDispatcher({
        adapters: createRegisteredAdapters()
      });
    }
  };
};

export const createDefaultComponentActionAdapterRegistry = (): ComponentActionAdapterRegistry => {
  const registry = createComponentActionAdapterRegistry();
  registry.register({
    componentType: 'builtin.note',
    source: 'builtin',
    adapter: createBuiltinNoteActionAdapter()
  });
  registry.register({
    componentType: 'builtin.text',
    source: 'builtin',
    adapter: createBuiltinTextActionAdapter()
  });
  registry.register({
    componentType: 'builtin.attachment',
    source: 'builtin',
    adapter: createBuiltinAttachmentActionAdapter()
  });
  return registry;
};

export const createDefaultComponentActionAdapters = (): ComponentActionAdapter[] => {
  return createDefaultComponentActionAdapterRegistry().createAdapters();
};

export const createDefaultComponentActionDispatcher = (): ComponentActionDispatcher => {
  return createDefaultComponentActionAdapterRegistry().createDispatcher();
};
