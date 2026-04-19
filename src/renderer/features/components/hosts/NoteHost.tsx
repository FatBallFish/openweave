import { canvasStore } from '../../canvas/canvas.store';
import { NoteNode } from '../../canvas/nodes/NoteNode';
import type { BuiltinHostProps } from './types';

export const NoteHost = ({ node }: BuiltinHostProps): JSX.Element => {
  return (
    <NoteNode
      node={{
        id: node.id,
        type: 'note',
        x: node.bounds.x,
        y: node.bounds.y,
        contentMd: typeof node.state.content === 'string' ? node.state.content : ''
      }}
      onChange={(patch) => {
        void canvasStore.updateNoteNode(node.id, patch);
      }}
    />
  );
};
