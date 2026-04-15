import type { GitStatusSummaryRecord } from '../../../shared/ipc/contracts';

interface GitPanelProps {
  nodeId: string;
  isGitRepo: boolean;
  readOnly: boolean;
  summary: GitStatusSummaryRecord;
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

export const GitPanel = ({ nodeId, isGitRepo, readOnly, summary }: GitPanelProps): JSX.Element => {
  const summaryLines = renderSummary(summary);

  return (
    <section
      data-testid={`git-panel-${nodeId}`}
      style={{ border: '1px solid #d0d7e2', borderRadius: '8px', padding: '8px', backgroundColor: '#f8fafc' }}
    >
      <h4 style={{ margin: 0 }}>Git status</h4>
      {isGitRepo ? (
        summaryLines.length > 0 ? (
          <ul style={{ margin: '8px 0', paddingLeft: '18px' }}>
            {summaryLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: '8px 0 0' }}>Working tree clean.</p>
        )
      ) : (
        <p style={{ margin: '8px 0 0' }}>Git repository not detected.</p>
      )}
      {readOnly ? (
        <p data-testid={`git-panel-readonly-${nodeId}`} style={{ margin: '8px 0 0', color: '#344054' }}>
          Read-only mode: Git write actions are disabled in this task.
        </p>
      ) : null}
    </section>
  );
};
