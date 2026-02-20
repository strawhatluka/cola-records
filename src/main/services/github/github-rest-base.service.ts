/**
 * GitHub REST Service — Base class
 *
 * Manages Octokit client initialization and token resolution.
 */
import { Octokit } from '@octokit/rest';
import { env } from '../environment.service';
import { database } from '../../database';

export class GitHubRestServiceBase {
  private client: Octokit | null = null;

  getClient(): Octokit {
    if (!this.client) {
      const settings = database.getAllSettings();
      const token = settings.githubToken || env.get('GITHUB_TOKEN');

      if (!token) {
        throw new Error(
          'GitHub token not configured. Please set GITHUB_TOKEN in settings or .env file.'
        );
      }

      this.client = new Octokit({
        auth: token,
        userAgent: 'Cola Records v1.0.0',
        timeZone: 'UTC',
      });
    }

    return this.client;
  }

  resetClient(): void {
    this.client = null;
  }
}
