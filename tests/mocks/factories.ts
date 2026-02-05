/**
 * Test Data Factories
 *
 * Creates typed mock data for use in tests. Each factory provides sensible
 * defaults that can be overridden via the `overrides` parameter.
 */
import type {
  Contribution,
  GitHubIssue,
  GitHubRepository,
  GitStatus,
  GitFileStatus,
  AppSettings,
  Alias,
  SpotifyTrack,
  SpotifyPlaybackState,
  SpotifyPlaylist,
  DiscordUser,
  DiscordGuild,
  DiscordChannel,
  DiscordDMChannel,
  DiscordMessage,
  DiscordThread,
  DiscordEmoji,
  DiscordAttachment,
  DiscordEmbed,
  DiscordReaction,
  ForumTag,
} from '../../src/main/ipc/channels';

export function createMockContribution(
  overrides?: Partial<Contribution>
): Contribution {
  return {
    id: `contrib_${Date.now()}_test`,
    repositoryUrl: 'https://github.com/test-org/test-repo',
    localPath: '/mock/contributions/test-repo',
    issueNumber: 42,
    issueTitle: 'Fix the thing',
    branchName: 'fix-issue-42',
    status: 'in_progress',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function createMockIssue(
  overrides?: Partial<GitHubIssue>
): GitHubIssue {
  return {
    id: 'issue_1',
    number: 42,
    title: 'Good first issue: Fix documentation typo',
    body: 'The README has a typo on line 5.',
    url: 'https://github.com/test-org/test-repo/issues/42',
    repository: 'test-org/test-repo',
    labels: ['good first issue', 'documentation'],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function createMockRepository(
  overrides?: Partial<GitHubRepository>
): GitHubRepository {
  return {
    id: 'repo_1',
    name: 'test-repo',
    fullName: 'test-org/test-repo',
    description: 'A test repository',
    url: 'https://github.com/test-org/test-repo',
    language: 'TypeScript',
    stars: 100,
    forks: 25,
    openIssues: 10,
    defaultBranch: 'main',
    ...overrides,
  };
}

export function createMockGitStatus(
  overrides?: Partial<GitStatus>
): GitStatus {
  return {
    current: 'main',
    tracking: 'origin/main',
    ahead: 0,
    behind: 0,
    files: [],
    ...overrides,
  };
}

export function createMockGitFileStatus(
  overrides?: Partial<GitFileStatus>
): GitFileStatus {
  return {
    path: 'src/index.ts',
    index: 'M',
    working_dir: ' ',
    ...overrides,
  };
}

export function createMockSettings(
  overrides?: Partial<AppSettings>
): AppSettings {
  return {
    theme: 'system',
    defaultClonePath: '/mock/contributions',
    defaultProjectsPath: '/mock/projects',
    defaultProfessionalProjectsPath: '/mock/professional-projects',
    autoFetch: true,
    aliases: [],
    ...overrides,
  };
}

export function createMockAlias(
  overrides?: Partial<Alias>
): Alias {
  return {
    name: 'gp',
    command: 'git push',
    ...overrides,
  };
}

// ── Spotify Factories ──────────────────────────────────────────────

export function createMockSpotifyTrack(
  overrides?: Partial<SpotifyTrack>
): SpotifyTrack {
  return {
    id: 'track_1',
    name: 'Test Track',
    uri: 'spotify:track:track_1',
    artists: [{ name: 'Test Artist' }],
    album: {
      name: 'Test Album',
      images: [{ url: 'https://i.scdn.co/image/test', width: 300, height: 300 }],
    },
    durationMs: 210000,
    ...overrides,
  };
}

export function createMockSpotifyPlaybackState(
  overrides?: Partial<SpotifyPlaybackState>
): SpotifyPlaybackState {
  return {
    isPlaying: true,
    track: createMockSpotifyTrack(),
    progressMs: 30000,
    shuffleState: false,
    volumePercent: 75,
    deviceName: 'Test Device',
    ...overrides,
  };
}

export function createMockSpotifyPlaylist(
  overrides?: Partial<SpotifyPlaylist>
): SpotifyPlaylist {
  return {
    id: 'playlist_1',
    name: 'Test Playlist',
    uri: 'spotify:playlist:playlist_1',
    trackCount: 25,
    images: [{ url: 'https://i.scdn.co/image/playlist', width: 300, height: 300 }],
    ...overrides,
  };
}

// ── Discord Factories ──────────────────────────────────────────────

export function createMockDiscordUser(
  overrides?: Partial<DiscordUser>
): DiscordUser {
  return {
    id: '123456789',
    username: 'testuser',
    discriminator: '0',
    globalName: 'Test User',
    avatar: 'abc123',
    ...overrides,
  };
}

export function createMockForumTag(
  overrides?: Partial<ForumTag>
): ForumTag {
  return {
    id: 'tag_1',
    name: 'Discussion',
    moderated: false,
    emojiId: null,
    emojiName: null,
    ...overrides,
  };
}

export function createMockDiscordChannel(
  overrides?: Partial<DiscordChannel>
): DiscordChannel {
  return {
    id: 'channel_1',
    name: 'general',
    type: 0,
    parentId: null,
    position: 0,
    topic: null,
    availableTags: [],
    ...overrides,
  };
}

export function createMockDiscordGuild(
  overrides?: Partial<DiscordGuild>
): DiscordGuild {
  return {
    id: 'guild_1',
    name: 'Test Server',
    icon: 'icon_hash',
    ownerId: '123456789',
    channels: [createMockDiscordChannel()],
    ...overrides,
  };
}

export function createMockDiscordThread(
  overrides?: Partial<DiscordThread>
): DiscordThread {
  return {
    id: 'thread_1',
    name: 'Test Thread',
    parentId: 'channel_1',
    ownerId: '123456789',
    messageCount: 5,
    createdTimestamp: '2026-01-01T00:00:00Z',
    archiveTimestamp: null,
    archived: false,
    locked: false,
    lastMessageId: 'msg_1',
    appliedTags: [],
    ...overrides,
  };
}

export function createMockDiscordDMChannel(
  overrides?: Partial<DiscordDMChannel>
): DiscordDMChannel {
  return {
    id: 'dm_1',
    type: 1,
    recipients: [createMockDiscordUser()],
    lastMessageId: 'msg_1',
    ...overrides,
  };
}

export function createMockDiscordAttachment(
  overrides?: Partial<DiscordAttachment>
): DiscordAttachment {
  return {
    id: 'attach_1',
    filename: 'image.png',
    url: 'https://cdn.discordapp.com/attachments/1/2/image.png',
    proxyUrl: 'https://media.discordapp.net/attachments/1/2/image.png',
    size: 102400,
    contentType: 'image/png',
    width: 800,
    height: 600,
    ...overrides,
  };
}

export function createMockDiscordEmbed(
  overrides?: Partial<DiscordEmbed>
): DiscordEmbed {
  return {
    title: 'Test Embed',
    description: 'Embed description',
    url: 'https://example.com',
    color: 0x5865f2,
    type: 'rich',
    thumbnail: null,
    image: null,
    video: null,
    author: null,
    footer: null,
    timestamp: null,
    provider: null,
    fields: [],
    ...overrides,
  };
}

export function createMockDiscordReaction(
  overrides?: Partial<DiscordReaction>
): DiscordReaction {
  return {
    emoji: { id: null, name: '👍' },
    count: 3,
    me: false,
    ...overrides,
  };
}

export function createMockDiscordMessage(
  overrides?: Partial<DiscordMessage>
): DiscordMessage {
  return {
    id: 'msg_1',
    content: 'Hello, world!',
    author: createMockDiscordUser(),
    timestamp: '2026-01-01T00:00:00Z',
    editedTimestamp: null,
    attachments: [],
    embeds: [],
    reactions: [],
    referencedMessage: null,
    mentionEveryone: false,
    mentions: [],
    pinned: false,
    type: 0,
    stickerItems: [],
    poll: null,
    ...overrides,
  };
}

export function createMockDiscordEmoji(
  overrides?: Partial<DiscordEmoji>
): DiscordEmoji {
  return {
    id: 'emoji_1',
    name: 'custom_emoji',
    animated: false,
    guildId: 'guild_1',
    ...overrides,
  };
}
