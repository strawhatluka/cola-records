import { ContributionStatusWidget } from '../components/dashboard/ContributionStatusWidget';
import { GitHubProfileWidget } from '../components/dashboard/GitHubProfileWidget';
import { PRsNeedingAttentionWidget } from '../components/dashboard/PRsNeedingAttentionWidget';
import { OpenIssuesWidget } from '../components/dashboard/OpenIssuesWidget';
import { RecentActivityWidget } from '../components/dashboard/RecentActivityWidget';
import { CICDStatusWidget } from '../components/dashboard/CICDStatusWidget';

export function DashboardScreen() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 pb-2">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Your contribution activity at a glance</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pt-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Row 1: At-a-Glance Stats */}
          <ContributionStatusWidget />
          <GitHubProfileWidget />

          {/* Row 2: Needs Attention */}
          <PRsNeedingAttentionWidget />
          <OpenIssuesWidget />

          {/* Row 3: Activity & Health */}
          <RecentActivityWidget />
          <CICDStatusWidget />
        </div>
      </div>
    </div>
  );
}
