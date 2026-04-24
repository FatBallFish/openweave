import fs from 'node:fs';
import path from 'node:path';

const NOTES_DIRNAME = 'notes';

const getNotesDir = (workspaceRootDir: string): string => {
  return path.join(workspaceRootDir, '.openweave', NOTES_DIRNAME);
};

const sanitizeNoteFilename = (title: string): string => {
  const sanitized = title
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 200);
  return sanitized.length > 0 ? sanitized : 'Note';
};

export const getNoteFilePath = (workspaceRootDir: string, title: string, nodeId: string): string => {
  const safeTitle = sanitizeNoteFilename(title);
  const shortId = nodeId.slice(0, 8);
  return path.join(getNotesDir(workspaceRootDir), `${safeTitle}-${shortId}.md`);
};

const ensureNotesDir = (workspaceRootDir: string): string => {
  const dir = getNotesDir(workspaceRootDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

export const createNoteFile = (workspaceRootDir: string, title: string, nodeId: string, content: string): string => {
  ensureNotesDir(workspaceRootDir);
  const filePath = getNoteFilePath(workspaceRootDir, title, nodeId);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
};

export const readNoteFile = (workspaceRootDir: string, title: string, nodeId: string): string => {
  const filePath = getNoteFilePath(workspaceRootDir, title, nodeId);
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
};

export const writeNoteFile = (workspaceRootDir: string, title: string, nodeId: string, content: string): string => {
  ensureNotesDir(workspaceRootDir);
  const filePath = getNoteFilePath(workspaceRootDir, title, nodeId);
  // Atomic write: write to temp file then rename
  const tmpPath = `${filePath}.tmp-${Date.now()}`;
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, filePath);
  return filePath;
};

export const deleteNoteFile = (workspaceRootDir: string, title: string, nodeId: string): string => {
  const filePath = getNoteFilePath(workspaceRootDir, title, nodeId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  // Clean up empty notes directory
  const dir = getNotesDir(workspaceRootDir);
  if (fs.existsSync(dir)) {
    const entries = fs.readdirSync(dir);
    if (entries.length === 0) {
      fs.rmdirSync(dir);
    }
  }
  return filePath;
};

export const renameNoteFile = (
  workspaceRootDir: string,
  oldTitle: string,
  newTitle: string,
  nodeId: string
): { oldPath: string; newPath: string } => {
  ensureNotesDir(workspaceRootDir);
  const oldPath = getNoteFilePath(workspaceRootDir, oldTitle, nodeId);
  const newPath = getNoteFilePath(workspaceRootDir, newTitle, nodeId);

  if (oldPath === newPath) {
    return { oldPath, newPath };
  }

  if (fs.existsSync(newPath)) {
    throw new Error(`A note file with the name "${sanitizeNoteFilename(newTitle)}-${nodeId.slice(0, 8)}" already exists`);
  }

  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
  }

  return { oldPath, newPath };
};

export const noteFileExists = (workspaceRootDir: string, title: string, nodeId: string): boolean => {
  return fs.existsSync(getNoteFilePath(workspaceRootDir, title, nodeId));
};
