
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';

export function DashboardScreen() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Welcome to Cola Records</h1>
        <p className="text-muted-foreground mt-2">
          Your platform for discovering and contributing to open source projects
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Active Contributions</CardTitle>
            <CardDescription>Projects you're currently working on</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">0</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Issues Viewed</CardTitle>
            <CardDescription>Total issues you've explored</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">0</div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>Start your open source journey</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">1. Navigate to <strong>Issues</strong> to discover open source projects</p>
            <p className="text-sm">2. Filter by your preferred programming language and difficulty</p>
            <p className="text-sm">3. Click <strong>Contribute</strong> to fork and clone a repository</p>
            <p className="text-sm">4. Manage your contributions in the <strong>Contributions</strong> tab</p>
            <p className="text-sm">5. Configure your GitHub token in <strong>Settings</strong></p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
