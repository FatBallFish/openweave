import type { FileTreeScanEntry } from './file-tree-service';
import { scanTree } from './file-tree-service';
import { gitStatus } from '../git/git-service';

interface FileTreeWorkerRequest {
  requestId: string;
  rootDir: string;
}

interface FileTreeWorkerSuccessResponse {
  requestId: string;
  ok: true;
  payload: {
    entries: FileTreeScanEntry[];
    isGitRepo: boolean;
    statuses: Record<string, string>;
  };
}

interface FileTreeWorkerErrorResponse {
  requestId: string;
  ok: false;
  error: string;
}

type FileTreeWorkerResponse = FileTreeWorkerSuccessResponse | FileTreeWorkerErrorResponse;

const toPlainObject = (statuses: Map<string, string>): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const [entryPath, status] of statuses.entries()) {
    result[entryPath] = status;
  }
  return result;
};

const sendResponse = (response: FileTreeWorkerResponse): void => {
  if (typeof process.send === 'function') {
    process.send(response);
  }
};

process.on('message', (message: unknown) => {
  const request = message as FileTreeWorkerRequest | undefined;
  if (!request || typeof request.requestId !== 'string' || typeof request.rootDir !== 'string') {
    return;
  }

  void Promise.all([scanTree(request.rootDir), gitStatus(request.rootDir)])
    .then(([entries, git]) => {
      sendResponse({
        requestId: request.requestId,
        ok: true,
        payload: {
          entries,
          isGitRepo: git.isGitRepo,
          statuses: toPlainObject(git.statuses as Map<string, string>)
        }
      });
    })
    .catch((error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load file tree';
      sendResponse({
        requestId: request.requestId,
        ok: false,
        error: errorMessage
      });
    });
});
