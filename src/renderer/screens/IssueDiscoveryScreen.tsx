import * as React from 'react';
import { SearchPanel } from '../components/issues/SearchPanel';
import { IssueList } from '../components/issues/IssueList';
import { IssueDetailModal } from '../components/issues/IssueDetailModal';
import { ContributionWorkflowModal } from '../components/contributions/ContributionWorkflowModal';
import { useIssuesStore } from '../stores/useIssuesStore';
import type { GitHubIssue, Contribution } from '../../main/ipc/channels';

interface IssueDiscoveryScreenProps {
  onOpenIDE?: (contribution: Contribution) => void;
}

export function IssueDiscoveryScreen({ onOpenIDE }: IssueDiscoveryScreenProps) {
  const { issues, loading, searchIssues } = useIssuesStore();
  const [selectedIssue, setSelectedIssue] = React.useState<GitHubIssue | null>(null);
  const [workflowIssue, setWorkflowIssue] = React.useState<GitHubIssue | null>(null);
  const [hideNoDescription, setHideNoDescription] = React.useState(false);

  const handleSearch = (query: string, labels: string[]) => {
    searchIssues(query, labels);
  };

  // Filter issues based on display options
  const filteredIssues = React.useMemo(() => {
    if (!hideNoDescription) return issues;
    return issues.filter((issue) => issue.body && issue.body.trim().length > 0);
  }, [issues, hideNoDescription]);

  const handleContribute = (issue: GitHubIssue) => {
    setWorkflowIssue(issue);
    setSelectedIssue(null);
  };

  const handleWorkflowComplete = () => {
    setWorkflowIssue(null);
  };

  return (
    <div className="flex h-full gap-4 p-4">
      {/* Left Panel - Search Filters */}
      <div className="w-80 flex-shrink-0">
        <SearchPanel
          onSearch={handleSearch}
          loading={loading}
          hideNoDescription={hideNoDescription}
          onHideNoDescriptionChange={setHideNoDescription}
        />
      </div>

      {/* Right Panel - Issue List */}
      <div className="flex-1">
        <IssueList issues={filteredIssues} onIssueSelect={setSelectedIssue} loading={loading} />
      </div>

      {/* Issue Detail Modal */}
      <IssueDetailModal
        issue={selectedIssue}
        onClose={() => setSelectedIssue(null)}
        onContribute={handleContribute}
      />

      {/* Contribution Workflow Modal */}
      <ContributionWorkflowModal
        issue={workflowIssue}
        isOpen={workflowIssue !== null}
        onClose={() => setWorkflowIssue(null)}
        onComplete={handleWorkflowComplete}
        onStartDev={onOpenIDE}
      />
    </div>
  );
}
