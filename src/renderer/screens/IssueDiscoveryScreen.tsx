import * as React from 'react';
import { SearchPanel } from '../components/issues/SearchPanel';
import { IssueList } from '../components/issues/IssueList';
import { IssueDetailModal } from '../components/issues/IssueDetailModal';
import { useIssuesStore } from '../stores/useIssuesStore';
import type { GitHubIssue } from '../../main/ipc/channels';

export function IssueDiscoveryScreen() {
  const { issues, loading, searchIssues } = useIssuesStore();
  const [selectedIssue, setSelectedIssue] = React.useState<GitHubIssue | null>(null);

  const handleSearch = (query: string, labels: string[]) => {
    searchIssues(query, labels);
  };

  const handleContribute = (issue: GitHubIssue) => {
    // This will be implemented in Phase 3 with the contribution workflow
    console.log('Contribute to issue:', issue);
    setSelectedIssue(null);
  };

  return (
    <div className="flex h-full gap-4 p-4">
      {/* Left Panel - Search Filters */}
      <div className="w-80 flex-shrink-0">
        <SearchPanel onSearch={handleSearch} loading={loading} />
      </div>

      {/* Right Panel - Issue List */}
      <div className="flex-1">
        <IssueList
          issues={issues}
          onIssueSelect={setSelectedIssue}
          loading={loading}
        />
      </div>

      {/* Issue Detail Modal */}
      <IssueDetailModal
        issue={selectedIssue}
        onClose={() => setSelectedIssue(null)}
        onContribute={handleContribute}
      />
    </div>
  );
}
