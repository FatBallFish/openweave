import type { IpcMainInvokeEvent } from 'electron';
import {
  noteFileCreateSchema,
  noteFileReadSchema,
  noteFileWriteSchema,
  noteFileDeleteSchema,
  noteFileRenameSchema
} from '../../shared/ipc/schemas';
import type {
  NoteFileCreateInput,
  NoteFileReadInput,
  NoteFileWriteInput,
  NoteFileDeleteInput,
  NoteFileRenameInput
} from '../../shared/ipc/schemas';
import type {
  NoteFileCreateResponse,
  NoteFileReadResponse,
  NoteFileWriteResponse,
  NoteFileDeleteResponse,
  NoteFileRenameResponse
} from '../../shared/ipc/contracts';
import {
  createNoteFile,
  readNoteFile,
  writeNoteFile,
  deleteNoteFile,
  renameNoteFile,
  getNoteFilePath
} from '../components/notes/note-file-service';

export interface NoteFileIpcDependencies {
  resolveWorkspaceRootDir: (workspaceId: string) => string;
}

export interface NoteFileIpcHandlers {
  create: (_event: IpcMainInvokeEvent, input: NoteFileCreateInput) => Promise<NoteFileCreateResponse>;
  read: (_event: IpcMainInvokeEvent, input: NoteFileReadInput) => Promise<NoteFileReadResponse>;
  write: (_event: IpcMainInvokeEvent, input: NoteFileWriteInput) => Promise<NoteFileWriteResponse>;
  delete: (_event: IpcMainInvokeEvent, input: NoteFileDeleteInput) => Promise<NoteFileDeleteResponse>;
  rename: (_event: IpcMainInvokeEvent, input: NoteFileRenameInput) => Promise<NoteFileRenameResponse>;
}

export const createNoteFileIpcHandlers = (deps: NoteFileIpcDependencies): NoteFileIpcHandlers => {
  return {
    create: async (_event, input) => {
      const parsed = noteFileCreateSchema.parse(input);
      const rootDir = deps.resolveWorkspaceRootDir(parsed.workspaceId);
      const filePath = createNoteFile(rootDir, parsed.title, parsed.nodeId, '');
      return { filePath, ok: true as const };
    },
    read: async (_event, input) => {
      const parsed = noteFileReadSchema.parse(input);
      const rootDir = deps.resolveWorkspaceRootDir(parsed.workspaceId);
      const content = readNoteFile(rootDir, parsed.title, parsed.nodeId);
      const filePath = getNoteFilePath(rootDir, parsed.title, parsed.nodeId);
      return { filePath, content };
    },
    write: async (_event, input) => {
      const parsed = noteFileWriteSchema.parse(input);
      const rootDir = deps.resolveWorkspaceRootDir(parsed.workspaceId);
      const filePath = writeNoteFile(rootDir, parsed.title, parsed.nodeId, parsed.content);
      return { filePath, ok: true as const };
    },
    delete: async (_event, input) => {
      const parsed = noteFileDeleteSchema.parse(input);
      const rootDir = deps.resolveWorkspaceRootDir(parsed.workspaceId);
      const filePath = deleteNoteFile(rootDir, parsed.title, parsed.nodeId);
      return { filePath, ok: true as const };
    },
    rename: async (_event, input) => {
      const parsed = noteFileRenameSchema.parse(input);
      const rootDir = deps.resolveWorkspaceRootDir(parsed.workspaceId);
      const { oldPath, newPath } = renameNoteFile(rootDir, parsed.oldTitle, parsed.newTitle, parsed.nodeId);
      return { oldPath, newPath, ok: true as const };
    }
  };
};
