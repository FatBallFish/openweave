import type { GitStatusSummaryRecord } from '../../../shared/ipc/contracts';

interface GitPanelProps {
  nodeId: string;
  isGitRepo: boolean;
  readOnly: boolean;
  summary: GitStatusSummaryRecord;
  onCreateBranchWorkspace?: () => void;
  canCreateBranchWorkspace?: boolean;
}

const renderSummary = (summary: GitStatusSummaryRecord): string[] => {
  const result: string[] = [];
  if (summary.modified > 0) {
    result.push(`Modified: ${summary.modified}`);
  }
  if (summary.added > 0) {
    result.push(`Added: ${summary.added}`);
  }
  if (summary.deleted > 0) {
    result.push(`Deleted: ${summary.deleted}`);
  }
  if (summary.renamed > 0) {
    result.push(`Renamed: ${summary.renamed}`);
  }
  if (summary.copied > 0) {
    result.push(`Copied: ${summary.copied}`);
  }
  if (summary.unmerged > 0) {
    result.push(`Unmerged: ${summary.unmerged}`);
  }
  if (summary.untracked > 0) {
    result.push(`Untracked: ${summary.untracked}`);
  }
  if (summary.ignored > 0) {
    result.push(`Ignored: ${summary.ignored}`);
  }
  return result;
};

export const GitPanel = ({
  nodeId,
  isGitRepo,
  readOnly,
  summary,
  onCreateBranchWorkspace,
  canCreateBranchWorkspace = true
}: GitPanelProps): JSX.Element => {
  const summaryLines = renderSummary(summary);

  return (
    <section className="ow-git-panel" data-testid={`git-panel-${nodeId}`}>
      <div className="ow-git-panel__header">
        <strong>Git status</strong>
        <span>{isGitRepo ? 'Repo detected' : 'No repo'}</span>
      </div>
      {isGitRepo ? (
        summaryLines.length > 0 ? (
          <ul className="ow-git-panel__summary">
            {summaryLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p>Working tree clean.</p>
        )
      ) : (
        <p>Git repository not detected.</p>
      )}
      {readOnly ? (
        <p className="ow-git-panel__readonly" data-testid={`git-panel-readonly-${nodeId}`}>
          Read-only repo surface
        </p>
      ) : null}
      {isGitRepo && onCreateBranchWorkspace ? (
        <button
          className="nodrag nopan"
          data-testid={`git-panel-branch-workspace-${nodeId}`}
          disabled={!canCreateBranchWorkspace}
          onClick={onCreateBranchWorkspace}
          type="button"
        >
          Branch workspace
        </button>
      ) : null}
    </section>
  );
};
