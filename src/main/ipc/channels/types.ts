/**
 * Shared IPC type definitions
 *
 * All interfaces and type aliases used across IPC channel definitions.
 */

// File System Types
export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: Date;
  children?: FileNode[];
  gitStatus?: 'M' | 'A' | 'D' | 'C' | null;
  isGitIgnored?: boolean;
}

export interface FileContent {
  path: string;
  content: string;
  encoding: string;
}

// Documentation Types
export interface DocsFile {
  name: string;
  path: string;
  displayName: string;
}

export interface DocsCategory {
  name: string;
  files: DocsFile[];
}

// Git Types
export interface GitStatus {
  current: string | null;
  tracking: string | null;
  ahead: number;
  behind: number;
  files: GitFileStatus[];
}

export interface GitFileStatus {
  path: string;
  index: string;
  working_dir: string;
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: Date;
}

// Branch Comparison Types
export interface DiffFileSummary {
  file: string;
  insertions: number;
  deletions: number;
  binary: boolean;
}

// Branch Info Types
export interface BranchInfo {
  name: string;
  isCurrent: boolean;
  isProtected: boolean;
  lastCommit: {
    hash: string;
    message: string;
    author: string;
    date: Date;
  };
  ahead: number;
  behind: number;
  commitCount: number;
}

export interface BranchComparison {
  commits: GitCommit[];
  files: DiffFileSummary[];
  totalInsertions: number;
  totalDeletions: number;
  totalFilesChanged: number;
  rawDiff: string;
}

// Reaction Types
export type ReactionContent =
  | '+1'
  | '-1'
  | 'laugh'
  | 'confused'
  | 'heart'
  | 'hooray'
  | 'rocket'
  | 'eyes';

export interface Reaction {
  id: number;
  content: ReactionContent;
  user: string;
}

// Sub-Issue Types
export interface SubIssue {
  id: number;
  number: number;
  title: string;
  state: string;
  url: string;
}

// PR Check Status Types
export interface PRCheckStatus {
  state: 'pending' | 'success' | 'failure' | 'unknown';
  total: number;
  passed: number;
  failed: number;
  pending: number;
}

// GitHub Types
export interface GitHubIssue {
  id: string;
  number: number;
  title: string;
  body: string;
  url: string;
  repository: string;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
  author?: string;
  authorAvatarUrl?: string;
}

export interface GitHubRepository {
  id: string;
  name: string;
  fullName: string;
  description: string;
  url: string;
  language: string;
  stars: number;
  forks: number;
  openIssues?: number;
  defaultBranch?: string;
}

// Repository Tree Types (for GitHub API)
export interface RepositoryTreeEntry {
  name: string;
  type: string;
  mode?: number;
  object?: {
    entries?: { name: string; type: string }[];
    byteSize?: number;
  };
}

// Contribution Types
export interface Contribution {
  id: string;
  repositoryUrl: string;
  localPath: string;
  issueNumber?: number;
  issueTitle?: string;
  branchName: string;
  status: 'in_progress' | 'ready' | 'submitted' | 'merged';
  createdAt: Date;
  updatedAt: Date;
  // Type discriminator: 'contribution' (default) or 'project'
  type?: 'project' | 'contribution';
  // PR tracking fields
  prUrl?: string;
  prNumber?: number;
  prStatus?: 'open' | 'closed' | 'merged';
  // Fork validation fields
  upstreamUrl?: string;
  isFork?: boolean;
  remotesValid?: boolean;
}

// Spotify Types
export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string; width: number; height: number }[];
  };
  durationMs: number;
}

export interface SpotifyPlaybackState {
  isPlaying: boolean;
  track: SpotifyTrack | null;
  progressMs: number;
  shuffleState: boolean;
  volumePercent: number;
  deviceName: string;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  uri: string;
  trackCount: number;
  images: { url: string; width: number; height: number }[];
}

// Discord Types
export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  globalName: string | null;
  avatar: string | null;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  ownerId: string;
  channels: DiscordChannel[];
}

export interface ForumTag {
  id: string;
  name: string;
  moderated: boolean;
  emojiId: string | null;
  emojiName: string | null;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number; // 0=text, 2=voice, 4=category, 5=announcement, 13=stage, 15=forum
  parentId: string | null;
  position: number;
  topic: string | null;
  availableTags: ForumTag[];
}

export interface DiscordThread {
  id: string;
  name: string;
  parentId: string;
  ownerId: string;
  messageCount: number;
  createdTimestamp: string | null;
  archiveTimestamp: string | null;
  archived: boolean;
  locked: boolean;
  lastMessageId: string | null;
  appliedTags: string[];
}

export interface DiscordDMChannel {
  id: string;
  type: number; // 1=DM, 3=group DM
  recipients: DiscordUser[];
  lastMessageId: string | null;
}

export interface DiscordMessage {
  id: string;
  content: string;
  author: DiscordUser;
  timestamp: string;
  editedTimestamp: string | null;
  attachments: DiscordAttachment[];
  embeds: DiscordEmbed[];
  reactions: DiscordReaction[];
  referencedMessage: DiscordMessage | null;
  mentionEveryone: boolean;
  mentions: DiscordUser[];
  pinned: boolean;
  type: number;
  stickerItems: DiscordStickerItem[];
  poll: DiscordPoll | null;
}

export interface DiscordStickerItem {
  id: string;
  name: string;
  formatType: number; // 1=PNG, 2=APNG, 3=LOTTIE, 4=GIF
}

export interface DiscordSticker {
  id: string;
  name: string;
  description: string | null;
  tags: string;
  formatType: number;
  packId: string | null;
  guildId: string | null;
}

export interface DiscordStickerPack {
  id: string;
  name: string;
  description: string;
  stickers: DiscordSticker[];
  bannerAssetId: string | null;
}

export interface DiscordPollAnswer {
  answerId: number;
  pollMedia: { text: string; emoji?: { id: string | null; name: string } };
}

export interface DiscordPoll {
  question: { text: string };
  answers: DiscordPollAnswer[];
  expiry: string | null;
  allowMultiselect: boolean;
  layoutType: number;
  results?: {
    isFinalized: boolean;
    answerCounts: { id: number; count: number; meVoted: boolean }[];
  };
}

export interface DiscordAttachment {
  id: string;
  filename: string;
  url: string;
  proxyUrl: string;
  size: number;
  contentType: string | null;
  width: number | null;
  height: number | null;
}

export interface DiscordEmbed {
  title: string | null;
  description: string | null;
  url: string | null;
  color: number | null;
  type: string | null;
  thumbnail: { url: string; width: number; height: number } | null;
  image: { url: string; width: number; height: number } | null;
  video: { url: string; width: number; height: number } | null;
  author: { name: string; url: string | null; iconUrl: string | null } | null;
  footer: { text: string; iconUrl: string | null } | null;
  timestamp: string | null;
  provider: { name: string; url: string | null } | null;
  fields: { name: string; value: string; inline: boolean }[];
}

export interface DiscordReaction {
  emoji: { id: string | null; name: string };
  count: number;
  me: boolean;
}

export interface DiscordEmoji {
  id: string;
  name: string;
  animated: boolean;
  guildId: string;
}

// Settings Types
export interface Alias {
  name: string;
  command: string;
}

export type TerminalColor = 'green' | 'blue' | 'cyan' | 'red' | 'yellow' | 'magenta' | 'white';

export interface BashProfileSettings {
  showUsername: boolean;
  showGitBranch: boolean;
  usernameColor: TerminalColor;
  pathColor: TerminalColor;
  gitBranchColor: TerminalColor;
  customUsername?: string;
}

// SSH Remote Types
export interface SSHRemote {
  id: string;
  name: string;
  hostname: string;
  user: string;
  port: number;
  keyPath: string;
  identitiesOnly: boolean;
}

// Terminal Types
export type ShellType = 'git-bash' | 'powershell' | 'cmd';

export interface TerminalSession {
  id: string;
  shellType: ShellType;
}

// Dev Scripts Types

/**
 * Configuration for a single terminal in a multi-terminal script
 */
export interface DevScriptTerminal {
  /** Terminal tab name (e.g., "Frontend", "Backend") */
  name: string;
  /** Commands to execute in this terminal */
  commands: string[];
}

/**
 * Configuration for a toggle-mode script that alternates between two states.
 * Each press cycles the button between first-press and second-press.
 */
export interface DevScriptToggle {
  firstPressName: string;
  firstPressCommand: string;
  secondPressName: string;
  secondPressCommand: string;
}

export interface DevScript {
  id: string;
  projectPath: string;
  name: string;
  /** @deprecated Use commands array or terminals array instead */
  command: string;
  /** Array of commands to execute sequentially (single terminal mode) */
  commands: string[];
  /** Array of terminal configurations for multi-terminal mode */
  terminals?: DevScriptTerminal[];
  /** Toggle configuration for toggle-mode scripts */
  toggle?: DevScriptToggle;
  createdAt?: string;
  updatedAt?: string;
}

// Project Detection Types
export type Ecosystem = 'node' | 'python' | 'rust' | 'go' | 'ruby' | 'php' | 'java' | 'unknown';

export type PackageManager =
  | 'npm'
  | 'yarn'
  | 'pnpm'
  | 'bun'
  | 'pip'
  | 'poetry'
  | 'uv'
  | 'cargo'
  | 'go'
  | 'bundler'
  | 'composer'
  | 'maven'
  | 'gradle'
  | 'unknown';

export interface ProjectScript {
  name: string;
  command: string;
}

export interface ProjectCommands {
  install: string | null;
  lint: string | null;
  format: string | null;
  test: string | null;
  coverage: string | null;
  build: string | null;
  typecheck: string | null;
  outdated: string | null;
  audit: string | null;
  clean: string | null;
}

export interface CleanTarget {
  name: string;
  path: string;
  sizeBytes: number;
}

export interface DiskUsageEntry {
  name: string;
  path: string;
  sizeBytes: number;
  exists: boolean;
}

export interface DiskUsageResult {
  totalBytes: number;
  entries: DiskUsageEntry[];
  scanDurationMs: number;
}

// Hook Tool Types
export type HookTool = 'husky' | 'lefthook' | 'pre-commit' | 'simple-git-hooks';
export type GitHookName = 'pre-commit' | 'commit-msg' | 'pre-push' | 'post-merge' | 'post-checkout';

export interface HookAction {
  id: string;
  label: string;
  command: string;
  description: string;
  enabled: boolean;
}

export interface LintStagedRule {
  id: string;
  pattern: string;
  commands: string[];
  enabled: boolean;
}

export interface LintStagedConfig {
  enabled: boolean;
  rules: LintStagedRule[];
}

export interface HookConfig {
  hookTool: HookTool;
  hooks: Record<GitHookName, HookAction[]>;
  lintStaged: LintStagedConfig | null;
}

export interface HookToolRecommendation {
  tool: HookTool;
  reason: string;
  supportsLintStaged: boolean;
}

export interface HooksDetectionResult {
  detected: HookTool | null;
  recommendations: HookToolRecommendation[];
  ecosystem: Ecosystem;
  hasLintStaged: boolean;
  existingConfig: HookConfig | null;
}

export interface HooksSetupResult {
  success: boolean;
  message: string;
}

export interface ProjectInfo {
  ecosystem: Ecosystem;
  packageManager: PackageManager;
  scripts: ProjectScript[];
  commands: ProjectCommands;
  hasGit: boolean;
  hasEnv: boolean;
  hasEnvExample: boolean;
  hasEditorConfig: boolean;
  hookTool: HookTool | null;
  typeChecker: string | null;
}

export interface SetUpActionResult {
  success: boolean;
  message: string;
}

// Env Scanner Types
export interface EnvSourceLocation {
  file: string;
  line: number;
}

export interface EnvVariable {
  name: string;
  sourceFile: string;
  lineNumber: number;
  sourceFiles: EnvSourceLocation[];
  category: 'credential' | 'url' | 'network' | 'config' | 'general';
  service: string;
  comment: string;
}

export interface EnvScanResult {
  variables: EnvVariable[];
  filesScanned: number;
  scanDurationMs: number;
}

export interface EnvFileInfo {
  name: string;
  relativePath: string;
  absolutePath: string;
  content: string;
  isExample: boolean;
}

export interface EnvSyncResult {
  newVariablesFound: number;
  filesUpdated: string[];
  message: string;
}

// EditorConfig Types
export interface EditorConfigProperties {
  indent_style?: 'tab' | 'space';
  indent_size?: number;
  tab_width?: number;
  end_of_line?: 'lf' | 'cr' | 'crlf';
  charset?: 'utf-8' | 'utf-8-bom' | 'latin1' | 'utf-16be' | 'utf-16le';
  trim_trailing_whitespace?: boolean;
  insert_final_newline?: boolean;
  max_line_length?: number | 'off';
}

export interface EditorConfigSection {
  glob: string;
  properties: EditorConfigProperties;
}

export interface EditorConfigFile {
  root: boolean;
  sections: EditorConfigSection[];
}

// Format Config Types
export type FormatterType = 'prettier' | 'ruff' | 'black' | 'rustfmt' | 'gofmt' | 'rubocop';

export interface FormatterInfo {
  formatter: FormatterType | null;
  configPath: string | null;
  hasConfig: boolean;
}

export interface PrettierConfig {
  semi?: boolean;
  trailingComma?: 'none' | 'es5' | 'all';
  singleQuote?: boolean;
  printWidth?: number;
  tabWidth?: number;
  useTabs?: boolean;
  arrowParens?: 'avoid' | 'always';
  endOfLine?: 'lf' | 'crlf' | 'cr' | 'auto';
  bracketSpacing?: boolean;
  jsxSingleQuote?: boolean;
  quoteProps?: 'as-needed' | 'consistent' | 'preserve';
  proseWrap?: 'always' | 'never' | 'preserve';
}

export interface FormatterConfig {
  formatter: FormatterType;
  config: PrettierConfig | Record<string, unknown>;
  configPath: string;
}

// Test Config Types
export type TestFrameworkType =
  | 'vitest'
  | 'jest'
  | 'mocha'
  | 'pytest'
  | 'go-test'
  | 'rspec'
  | 'phpunit'
  | 'cargo-test'
  | 'junit';

export interface TestFrameworkInfo {
  framework: TestFrameworkType | null;
  configPath: string | null;
  hasConfig: boolean;
  coverageCommand: string | null;
  watchCommand: string | null;
}

export interface VitestConfig {
  environment?: 'jsdom' | 'happy-dom' | 'node' | 'edge-runtime';
  globals?: boolean;
  coverageProvider?: 'v8' | 'istanbul';
  coverageStatements?: number;
  coverageBranches?: number;
  coverageFunctions?: number;
  coverageLines?: number;
  testTimeout?: number;
}

export interface JestConfig {
  testEnvironment?: 'jsdom' | 'node';
  collectCoverage?: boolean;
  coverageProvider?: 'v8' | 'babel';
}

export interface TestFrameworkConfig {
  framework: TestFrameworkType;
  config: VitestConfig | JestConfig | Record<string, unknown>;
  configPath: string;
}

// Coverage Config Types
export type CoverageProviderType =
  | 'v8'
  | 'istanbul'
  | 'nyc'
  | 'coverage-py'
  | 'go-cover'
  | 'simplecov'
  | 'phpunit'
  | 'tarpaulin'
  | 'jacoco';

export interface CoverageProviderInfo {
  provider: CoverageProviderType | null;
  configPath: string | null;
  hasConfig: boolean;
  reportPath: string | null;
}

export interface VitestCoverageConfig {
  provider?: 'v8' | 'istanbul';
  statements?: number;
  branches?: number;
  functions?: number;
  lines?: number;
  include?: string[];
  exclude?: string[];
  reporters?: string[];
  reportsDirectory?: string;
  all?: boolean;
  cleanOnRerun?: boolean;
}

export interface CoverageConfig {
  provider: CoverageProviderType;
  config: VitestCoverageConfig | Record<string, unknown>;
  configPath: string;
}

// Build Config Types
export type BuildToolType =
  | 'vite'
  | 'webpack'
  | 'rollup'
  | 'esbuild'
  | 'tsc'
  | 'parcel'
  | 'setuptools'
  | 'poetry-build'
  | 'go-build'
  | 'cargo-build'
  | 'gradle'
  | 'maven'
  | 'bundler'
  | 'composer';

export interface BuildToolInfo {
  buildTool: BuildToolType | null;
  configPath: string | null;
  hasConfig: boolean;
}

export interface ViteBuildConfig {
  outDir?: string;
  target?: string;
  sourcemap?: boolean | 'inline' | 'hidden';
  minify?: boolean | 'terser' | 'esbuild';
  cssMinify?: boolean;
  manifest?: boolean;
  emptyOutDir?: boolean;
  assetsInlineLimit?: number;
  chunkSizeWarningLimit?: number;
}

export interface BuildConfig {
  buildTool: BuildToolType;
  config: ViteBuildConfig | Record<string, unknown>;
  configPath: string;
}

export interface EnvVar {
  key: string;
  value: string;
}

export interface CodeServerConfig {
  cpuLimit: number | null;
  memoryLimit: string | null;
  shmSize: string;
  autoStartDocker: boolean;
  healthCheckTimeout: number;
  autoSyncHostSettings: boolean;
  gpuAcceleration: 'on' | 'off' | 'auto';
  terminalScrollback: number;
  autoInstallExtensions: string[];
  timezone: string;
  customEnvVars: EnvVar[];
  containerName: string;
}

export interface AppSettings {
  githubToken?: string;
  spotifyClientId?: string;
  discordToken?: string;
  theme: 'light' | 'dark' | 'system';
  defaultClonePath: string;
  defaultProjectsPath: string;
  defaultProfessionalProjectsPath: string;
  autoFetch: boolean;
  aliases?: Alias[];
  bashProfile?: BashProfileSettings;
  codeServerConfig?: CodeServerConfig;
}
