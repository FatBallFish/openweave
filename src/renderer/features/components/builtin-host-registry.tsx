import type { ComponentManifestV1 } from '../../../shared/components/manifest';
import { getBuiltinComponentManifest } from '../../../shared/components/builtin-manifests';
import { AttachmentHost } from './hosts/AttachmentHost';
import { FileTreeHost } from './hosts/FileTreeHost';
import { NoteHost } from './hosts/NoteHost';
import { PortalHost } from './hosts/PortalHost';
import { TerminalHost } from './hosts/TerminalHost';
import { TextHost } from './hosts/TextHost';
import type { BuiltinHostProps } from './hosts/types';
import { UnsupportedBuiltinHost } from './hosts/UnsupportedBuiltinHost';

export type BuiltinHostComponent = (props: BuiltinHostProps) => JSX.Element;

export interface BuiltinHostRegistration {
  manifest: ComponentManifestV1;
  HostComponent: BuiltinHostComponent;
}

const builtinHostComponents: Record<string, BuiltinHostComponent> = {
  'builtin.note': NoteHost,
  'builtin.terminal': TerminalHost,
  'builtin.file-tree': FileTreeHost,
  'builtin.portal': PortalHost,
  'builtin.text': TextHost,
  'builtin.attachment': AttachmentHost
};

export const resolveBuiltinHostRegistration = (
  componentType: string
): BuiltinHostRegistration | null => {
  const manifest = getBuiltinComponentManifest(componentType);
  const HostComponent = builtinHostComponents[componentType];
  if (!manifest || !HostComponent) {
    return null;
  }
  return {
    manifest,
    HostComponent
  };
};

export const renderBuiltinHost = (props: BuiltinHostProps): JSX.Element => {
  const registration = resolveBuiltinHostRegistration(props.node.componentType);
  const HostComponent = registration?.HostComponent ?? UnsupportedBuiltinHost;
  return <HostComponent {...props} />;
};
