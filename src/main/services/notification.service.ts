/**
 * Notification Service
 *
 * Polls GitHub for new events (PR reviews, CI failures, issue assignments)
 * and pushes notifications to the renderer process via IPC events.
 * Also handles native OS notifications when the window is unfocused.
 */
import { BrowserWindow, Notification as ElectronNotification } from 'electron';
import { Octokit } from '@octokit/rest';
import { database } from '../database';
import { createLogger } from '../utils/logger';
import type { AppNotification, NotificationPreferences } from '../ipc/channels';

const logger = createLogger('NotificationService');

const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function generateId(): string {
  return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

class NotificationService {
  private mainWindow: BrowserWindow | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastPollTime: number = 0;
  private client: Octokit | null = null;

  initialize(window: BrowserWindow): void {
    this.mainWindow = window;

    // Start polling after a short delay to let app settle
    setTimeout(() => {
      this.startPolling();
    }, 10_000);

    // Run auto-purge on startup
    this.autoPurge();
  }

  private getClient(): Octokit | null {
    if (this.client) return this.client;

    try {
      const settings = database.getAllSettings();
      const token = settings.githubToken;
      if (!token) return null;

      this.client = new Octokit({ auth: token, userAgent: 'Cola Records' });
      return this.client;
    } catch {
      return null;
    }
  }

  private getPreferences(): NotificationPreferences {
    const json = database.getSetting('notificationPreferences');
    if (json) {
      try {
        return JSON.parse(json);
      } catch {
        // fall through
      }
    }
    return {
      enabled: true,
      toastsEnabled: true,
      nativeEnabled: true,
      soundEnabled: false,
      dndEnabled: false,
      pollInterval: 5,
      categories: {
        'github-pr': { enabled: true, toast: true, native: true },
        'github-issue': { enabled: true, toast: true, native: true },
        'github-ci': { enabled: true, toast: true, native: true },
        git: { enabled: true, toast: true, native: false },
        system: { enabled: true, toast: true, native: false },
        integration: { enabled: true, toast: true, native: false },
      },
    };
  }

  private startPolling(): void {
    const prefs = this.getPreferences();
    if (!prefs.enabled) return;

    const intervalMs = (prefs.pollInterval || 5) * 60 * 1000;

    // Initial poll
    this.poll();

    // Set recurring timer
    this.pollTimer = setInterval(() => this.poll(), intervalMs);
    logger.info(`GitHub polling started (interval: ${prefs.pollInterval}min)`);
  }

  private async poll(): Promise<void> {
    const prefs = this.getPreferences();
    if (!prefs.enabled) return;

    const client = this.getClient();
    if (!client) return;

    try {
      // Fetch recent events for authenticated user
      const since = this.lastPollTime || Date.now() - DEFAULT_POLL_INTERVAL_MS;
      const response = await client.activity.listNotificationsForAuthenticatedUser({
        since: new Date(since).toISOString(),
        all: false,
      });

      this.lastPollTime = Date.now();

      const events = response.data;
      if (!events || events.length === 0) return;

      const notifications: AppNotification[] = [];

      for (const event of events) {
        const notification = this.mapGitHubNotification(event);
        if (!notification) continue;

        // Check category preference
        const catPref = prefs.categories[notification.category];
        if (catPref && !catPref.enabled) continue;

        notifications.push(notification);

        // Persist to DB
        database.addNotification(notification);

        // Send native OS notification if enabled, not DND, and window unfocused
        if (
          prefs.nativeEnabled &&
          !prefs.dndEnabled &&
          (!catPref || catPref.native) &&
          this.mainWindow &&
          !this.mainWindow.isFocused() &&
          ElectronNotification.isSupported()
        ) {
          new ElectronNotification({
            title: notification.title,
            body: notification.message,
          }).show();
        }
      }

      if (notifications.length > 0) {
        this.sendToRenderer('notification:batch', notifications);
        logger.info(`Pushed ${notifications.length} GitHub notifications`);
      }
    } catch (error) {
      logger.error('GitHub poll failed:', error);
    }
  }

  private mapGitHubNotification(event: {
    id: string;
    reason: string;
    subject: { title: string; type: string; url: string | null };
    repository: { full_name: string };
    updated_at: string;
  }): AppNotification | null {
    const { subject, repository, reason, updated_at } = event;
    const repoName = repository.full_name;

    let category: AppNotification['category'] = 'github-issue';
    let priority: AppNotification['priority'] = 'low';
    let title = '';
    let message = '';

    switch (subject.type) {
      case 'PullRequest':
        category = 'github-pr';
        if (reason === 'review_requested') {
          priority = 'high';
          title = 'Review Requested';
          message = `${subject.title} in ${repoName}`;
        } else if (reason === 'mention') {
          priority = 'medium';
          title = 'Mentioned in PR';
          message = `${subject.title} in ${repoName}`;
        } else {
          title = 'PR Activity';
          message = `${subject.title} in ${repoName}`;
        }
        break;

      case 'Issue':
        category = 'github-issue';
        if (reason === 'assign') {
          priority = 'medium';
          title = 'Issue Assigned';
          message = `${subject.title} in ${repoName}`;
        } else if (reason === 'mention') {
          priority = 'medium';
          title = 'Mentioned in Issue';
          message = `${subject.title} in ${repoName}`;
        } else {
          title = 'Issue Activity';
          message = `${subject.title} in ${repoName}`;
        }
        break;

      case 'CheckSuite':
        category = 'github-ci';
        priority = 'medium';
        title = 'CI Update';
        message = `${subject.title} in ${repoName}`;
        break;

      default:
        title = 'GitHub Notification';
        message = `${subject.title} in ${repoName}`;
    }

    return {
      id: generateId(),
      category,
      priority,
      title,
      message,
      timestamp: new Date(updated_at).getTime(),
      read: false,
      dismissed: false,
      dedupeKey: `github-${event.id}`,
      actionScreen: category === 'github-pr' ? 'contributions' : 'issues',
      groupKey: `${repoName}/${subject.type}`,
    };
  }

  private sendToRenderer(channel: string, ...args: unknown[]): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, ...args);
    }
  }

  private autoPurge(): void {
    try {
      database.purgeOldNotifications(30);
      logger.info('Auto-purged notifications older than 30 days');
    } catch {
      // DB might not be ready yet
    }
  }

  /** Reset Octokit client (e.g. when token changes) */
  resetClient(): void {
    this.client = null;
  }

  cleanup(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.mainWindow = null;
    logger.info('Notification service cleaned up');
  }
}

export const notificationService = new NotificationService();
