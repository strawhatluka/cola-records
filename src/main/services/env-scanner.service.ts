/**
 * Env Scanner Service
 *
 * Recursively walks source files and extracts environment variable references
 * using ecosystem-specific regex patterns. Also scans Docker Compose and
 * Dockerfile for ${VAR} references. Categorizes variables by name pattern,
 * detects service provider, and tracks all source file occurrences.
 *
 * Platform-injected variables (e.g. VERCEL, VERCEL_ENV) are automatically
 * filtered from results since they are set by the hosting platform, not by users.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import type {
  Ecosystem,
  EnvVariable,
  EnvScanResult,
  EnvSourceLocation,
} from '../ipc/channels/types';

const logger = createLogger('env-scanner');

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'vendor',
  'target',
  'coverage',
  'out',
  '__pycache__',
  '.next',
  '.nuxt',
  '.turbo',
]);

/** Variables auto-set by hosting platforms — users never configure these */
const PLATFORM_INJECTED_VARS = new Set([
  'VERCEL',
  'VERCEL_ENV',
  'VERCEL_URL',
  'VERCEL_REGION',
  'VERCEL_GIT_COMMIT_SHA',
  'VERCEL_GIT_COMMIT_MESSAGE',
  'VERCEL_GIT_COMMIT_AUTHOR_LOGIN',
  'VERCEL_GIT_COMMIT_AUTHOR_NAME',
  'VERCEL_GIT_COMMIT_REF',
  'VERCEL_GIT_PROVIDER',
  'VERCEL_GIT_REPO_SLUG',
  'VERCEL_GIT_REPO_OWNER',
  'VERCEL_GIT_REPO_ID',
  'VERCEL_GIT_PULL_REQUEST_ID',
  'VERCEL_BRANCH_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'CI',
  'NODE_ENV',
  'HOME',
  'PATH',
  'USER',
  'SHELL',
  'LANG',
  'TERM',
  'PWD',
  'HOSTNAME',
]);

const ECOSYSTEM_EXTENSIONS: Record<Ecosystem, Set<string>> = {
  node: new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']),
  python: new Set(['.py']),
  rust: new Set(['.rs']),
  go: new Set(['.go']),
  ruby: new Set(['.rb']),
  php: new Set(['.php']),
  java: new Set(['.java']),
  unknown: new Set([
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.py',
    '.rs',
    '.go',
    '.rb',
    '.php',
    '.java',
  ]),
};

const ECOSYSTEM_PATTERNS: Record<Ecosystem, RegExp[]> = {
  node: [/process\.env\.([A-Z_][A-Z0-9_]*)/g, /process\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g],
  python: [
    /os\.environ\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
    /os\.getenv\(['"]([A-Z_][A-Z0-9_]*)['"]\)/g,
    /os\.environ\.get\(['"]([A-Z_][A-Z0-9_]*)['"]\)/g,
  ],
  rust: [/std::env::var\(['"]([A-Z_][A-Z0-9_]*)['"]\)/g, /env::var\(['"]([A-Z_][A-Z0-9_]*)['"]\)/g],
  go: [/os\.Getenv\(['"]([A-Z_][A-Z0-9_]*)['"]\)/g],
  ruby: [/ENV\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g],
  php: [/\$_ENV\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g, /getenv\(['"]([A-Z_][A-Z0-9_]*)['"]\)/g],
  java: [/System\.getenv\(['"]([A-Z_][A-Z0-9_]*)['"]\)/g],
  unknown: [
    /process\.env\.([A-Z_][A-Z0-9_]*)/g,
    /process\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
    /os\.environ\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
    /os\.getenv\(['"]([A-Z_][A-Z0-9_]*)['"]\)/g,
    /os\.Getenv\(['"]([A-Z_][A-Z0-9_]*)['"]\)/g,
    /ENV\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g,
    /System\.getenv\(['"]([A-Z_][A-Z0-9_]*)['"]\)/g,
  ],
};

type EnvCategory = EnvVariable['category'];

const CATEGORY_PATTERNS: [RegExp, EnvCategory][] = [
  [/TOKEN|SECRET|KEY|PASSWORD|API_KEY|PRIVATE|AUTH/i, 'credential'],
  [/URL|ENDPOINT|HOST|BASE_URL|ORIGIN|DOMAIN/i, 'url'],
  [/PORT/i, 'network'],
  [/TIMEOUT|TTL|RETRY|LIMIT|MAX|MIN|INTERVAL|DURATION|THRESHOLD/i, 'config'],
];

const CATEGORY_COMMENTS: Record<EnvCategory, string> = {
  credential: 'Sensitive credential — keep secret',
  url: 'URL or endpoint address',
  network: 'Network port configuration',
  config: 'Application configuration value',
  general: 'Environment variable',
};

/**
 * Service provider detection — matches variable name prefixes to known services.
 * Order matters: more specific prefixes should come before generic ones.
 */
const SERVICE_PATTERNS: [RegExp, string][] = [
  // Communication & Social
  [/^DISCORD_/, 'Discord'],
  [/^SLACK_/, 'Slack'],
  [/^TWILIO_/, 'Twilio'],

  // Auth & Identity
  [/^NEXTAUTH_/, 'NextAuth'],
  [/^AUTH0_/, 'Auth0'],
  [/^CLERK_/, 'Clerk'],
  [/^AUTH_/, 'Auth'],

  // Source Control & CI
  [/^GITHUB_/, 'GitHub'],
  [/^GITLAB_/, 'GitLab'],
  [/^BITBUCKET_/, 'Bitbucket'],

  // Frameworks
  [/^NEXT_PUBLIC_/, 'Next.js (Public)'],
  [/^NEXT_/, 'Next.js'],
  [/^NUXT_/, 'Nuxt'],
  [/^VITE_/, 'Vite'],
  [/^REACT_APP_/, 'React (CRA)'],

  // Cloud Providers
  [/^AWS_/, 'AWS'],
  [/^S3_/, 'AWS S3'],
  [/^AZURE_/, 'Azure'],
  [/^GCP_|^GCLOUD_/, 'Google Cloud'],
  [/^GOOGLE_/, 'Google'],

  // Hosting & Deployment
  [/^VERCEL_/, 'Vercel'],
  [/^HEROKU_/, 'Heroku'],
  [/^FLY_/, 'Fly.io'],
  [/^NETLIFY_/, 'Netlify'],
  [/^RAILWAY_/, 'Railway'],
  [/^RENDER_/, 'Render'],
  [/^DOCKER_/, 'Docker'],
  [/^CLOUDFLARE_/, 'Cloudflare'],

  // Payments & Commerce
  [/^STRIPE_/, 'Stripe'],
  [/^PAYPAL_/, 'PayPal'],
  [/^SHOPIFY_/, 'Shopify'],

  // Email & Notifications
  [/^SENDGRID_/, 'SendGrid'],
  [/^RESEND_/, 'Resend'],
  [/^MAILGUN_/, 'Mailgun'],
  [/^POSTMARK_/, 'Postmark'],
  [/^SMTP_|^MAIL_|^EMAIL_/, 'Email/SMTP'],

  // Monitoring & Error Tracking
  [/^SENTRY_/, 'Sentry'],
  [/^ROLLBAR_/, 'Rollbar'],
  [/^DATADOG_/, 'Datadog'],
  [/^NEW_RELIC_|^NEWRELIC_/, 'New Relic'],
  [/^LOGROCKET_/, 'LogRocket'],

  // Databases
  [/^POSTGRES_|^PG_|^PGHOST/, 'PostgreSQL'],
  [/^MYSQL_/, 'MySQL'],
  [/^MONGO_|^MONGODB_/, 'MongoDB'],
  [/^REDIS_/, 'Redis'],
  [/^DATABASE_/, 'Database'],
  [/^SUPABASE_/, 'Supabase'],
  [/^FIREBASE_/, 'Firebase'],
  [/^NEON_/, 'Neon'],
  [/^PLANETSCALE_/, 'PlanetScale'],
  [/^TURSO_/, 'Turso'],

  // AI & ML
  [/^OPENAI_/, 'OpenAI'],
  [/^ANTHROPIC_/, 'Anthropic'],
  [/^HUGGINGFACE_|^HF_/, 'Hugging Face'],
  [/^REPLICATE_/, 'Replicate'],
  [/^COHERE_/, 'Cohere'],

  // Storage & CDN
  [/^UPLOADTHING_/, 'UploadThing'],
  [/^CLOUDINARY_/, 'Cloudinary'],
  [/^MINIO_/, 'MinIO'],

  // Music & Media
  [/^SPOTIFY_/, 'Spotify'],

  // Analytics
  [/^MIXPANEL_/, 'Mixpanel'],
  [/^AMPLITUDE_/, 'Amplitude'],
  [/^POSTHOG_/, 'PostHog'],
  [/^PLAUSIBLE_/, 'Plausible'],
];

/**
 * Functional group fallback — when no service prefix matches, group by
 * name patterns that indicate the variable's functional purpose.
 * This prevents a giant catch-all "General" section.
 */
const FUNCTIONAL_GROUP_PATTERNS: [RegExp, string][] = [
  [/^LOG_|^DEBUG|^VERBOSE/, 'Logging & Debug'],
  [/^ADMIN_/, 'Admin'],
  [/^BOT_/, 'Bot'],
  [/^CRON_|^CRONJOB_|^SCHEDULE_/, 'Scheduled Tasks'],
  [/^DEPLOY|^ENVIRONMENT|^APP_ENV|^DEPLOYMENT_/, 'Deployment'],
  [/^HEALTH_|^HEALTHCHECK_/, 'Health Checks'],
  [/^CACHE_/, 'Cache'],
  [/^SESSION_|^COOKIE_/, 'Sessions'],
  [/^CORS_|^ALLOWED_/, 'CORS & Security'],
  [/^RATE_LIMIT_|^THROTTLE_/, 'Rate Limiting'],
  [/^FEATURE_|^FLAG_|^FF_/, 'Feature Flags'],
  [/^WEBHOOK_/, 'Webhooks'],
  [/^QUEUE_|^WORKER_|^JOB_/, 'Queues & Workers'],
  [/^TEST_/, 'Testing'],
  [/^APP_/, 'Application'],
];

/** Docker Compose variable patterns: ${VAR}, ${VAR:-default}, ${VAR:?error} */
const DOCKER_COMPOSE_VAR = /\$\{([A-Z_][A-Z0-9_]*)(?::-[^}]*|:\?[^}]*)?\}/g;

function categorize(name: string): EnvCategory {
  for (const [pattern, category] of CATEGORY_PATTERNS) {
    if (pattern.test(name)) return category;
  }
  return 'general';
}

function detectService(name: string): string {
  for (const [pattern, service] of SERVICE_PATTERNS) {
    if (pattern.test(name)) return service;
  }
  for (const [pattern, group] of FUNCTIONAL_GROUP_PATTERNS) {
    if (pattern.test(name)) return group;
  }
  return 'General';
}

interface InternalVar {
  name: string;
  sourceFiles: EnvSourceLocation[];
  category: EnvCategory;
  service: string;
  comment: string;
  source: 'code' | 'docker';
}

async function walkDirectory(
  dir: string,
  rootDir: string,
  extensions: Set<string>,
  patterns: RegExp[],
  seen: Map<string, InternalVar>,
  filesScanned: { count: number }
): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    const name = String(entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(name) || name.startsWith('.')) continue;
      await walkDirectory(path.join(dir, name), rootDir, extensions, patterns, seen, filesScanned);
    } else if (entry.isFile()) {
      const ext = path.extname(name).toLowerCase();
      if (!extensions.has(ext)) continue;

      const filePath = path.join(dir, name);
      let content: string;
      try {
        content = await fs.readFile(filePath, 'utf-8');
      } catch {
        continue;
      }
      filesScanned.count++;

      for (const regex of patterns) {
        regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(content)) !== null) {
          const varName = match[1];
          if (PLATFORM_INJECTED_VARS.has(varName)) continue;

          const charIndex = match.index;
          const lineNumber = content.substring(0, charIndex).split('\n').length;
          const relativePath = path.relative(rootDir, filePath).split(path.sep).join('/');
          const location: EnvSourceLocation = { file: relativePath, line: lineNumber };

          const existing = seen.get(varName);
          if (existing) {
            // Add additional occurrence if not already tracked for this file+line
            const alreadyTracked = existing.sourceFiles.some(
              (s) => s.file === relativePath && s.line === lineNumber
            );
            if (!alreadyTracked) {
              existing.sourceFiles.push(location);
            }
          } else {
            const category = categorize(varName);
            seen.set(varName, {
              name: varName,
              sourceFiles: [location],
              category,
              service: detectService(varName),
              comment: CATEGORY_COMMENTS[category],
              source: 'code',
            });
          }
        }
      }
    }
  }
}

/**
 * Scan Docker Compose and Dockerfile for ${VAR} references.
 * These are infrastructure variables that may not appear in source code.
 */
async function scanDockerFiles(directory: string, seen: Map<string, InternalVar>): Promise<void> {
  const dockerFiles = [
    'docker-compose.yml',
    'docker-compose.yaml',
    'docker-compose.dev.yml',
    'docker-compose.dev.yaml',
    'docker-compose.prod.yml',
    'docker-compose.prod.yaml',
    'docker-compose.override.yml',
    'docker-compose.override.yaml',
    'Dockerfile',
    'Dockerfile.dev',
    'Dockerfile.prod',
  ];

  for (const fileName of dockerFiles) {
    const filePath = path.join(directory, fileName);
    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      continue;
    }

    DOCKER_COMPOSE_VAR.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = DOCKER_COMPOSE_VAR.exec(content)) !== null) {
      const varName = match[1];
      if (PLATFORM_INJECTED_VARS.has(varName)) continue;

      const charIndex = match.index;
      const lineNumber = content.substring(0, charIndex).split('\n').length;
      const location: EnvSourceLocation = { file: fileName, line: lineNumber };

      const existing = seen.get(varName);
      if (existing) {
        const alreadyTracked = existing.sourceFiles.some(
          (s) => s.file === fileName && s.line === lineNumber
        );
        if (!alreadyTracked) {
          existing.sourceFiles.push(location);
        }
      } else {
        const category = categorize(varName);
        seen.set(varName, {
          name: varName,
          sourceFiles: [location],
          category,
          service: detectService(varName),
          comment: CATEGORY_COMMENTS[category],
          source: 'docker',
        });
      }
    }
  }
}

class EnvScannerService {
  async scan(directory: string, ecosystem: Ecosystem): Promise<EnvScanResult> {
    const startTime = Date.now();
    logger.info(`Scanning for env variables in: ${directory} (${ecosystem})`);

    const extensions = ECOSYSTEM_EXTENSIONS[ecosystem];
    const patterns = ECOSYSTEM_PATTERNS[ecosystem];
    const seen = new Map<string, InternalVar>();
    const filesScanned = { count: 0 };

    await walkDirectory(directory, directory, extensions, patterns, seen, filesScanned);
    await scanDockerFiles(directory, seen);

    const variables: EnvVariable[] = Array.from(seen.values()).map((v) => ({
      name: v.name,
      sourceFile: v.sourceFiles[0].file,
      lineNumber: v.sourceFiles[0].line,
      sourceFiles: v.sourceFiles,
      category: v.category,
      service: v.service,
      comment: v.comment,
    }));

    const scanDurationMs = Date.now() - startTime;

    logger.info(
      `Found ${variables.length} env variables in ${filesScanned.count} files (${scanDurationMs}ms)`
    );

    return { variables, filesScanned: filesScanned.count, scanDurationMs };
  }
}

export const envScannerService = new EnvScannerService();
