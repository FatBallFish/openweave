import { canvasStore } from '../../canvas/canvas.store';
import { BuiltinNodeFrame } from '../host-shell/BuiltinNodeFrame';
import { getBuiltinNodeStateLabel, resolveBuiltinNodeState } from '../host-shell/node-state';
import type { BuiltinHostProps } from './types';

export const NoteHost = ({ node }: BuiltinHostProps): JSX.Element => {
  const content = typeof node.state.content === 'string' ? node.state.content : '';
  const state = resolveBuiltinNodeState(node);
  const wordCount = content.trim().length === 0 ? 0 : content.trim().split(/\s+/).length;

  return (
    <BuiltinNodeFrame
      actions={['Checklist', 'Heading']}
      footer={[`${wordCount} words`, 'Editable markdown', 'Canvas-linked note']}
      iconLabel="NT"
      nodeId={node.id}
      state={state}
      stateLabel={getBuiltinNodeStateLabel(state)}
      subtitle="Editable markdown"
      title={node.title}
    >
      <div className="ow-note-host">
        <div className="ow-note-host__toolbar">
          <span>Plan</span>
          <span>Checklist</span>
          <span>Code block</span>
        </div>
        <textarea
          aria-label="Markdown note"
          className="ow-note-host__editor"
          data-testid={`note-host-editor-${node.id}`}
          onChange={(event) => {
            void canvasStore.updateNoteNode(node.id, { contentMd: event.currentTarget.value });
          }}
          spellCheck={false}
          value={content}
        />
      </div>
    </BuiltinNodeFrame>
  );
};
