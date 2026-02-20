/**
 * Strips authentication tokens from git error messages.
 * Prevents token leakage when errors propagate to the renderer process.
 */
export function sanitizeGitError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // Strip x-access-token URLs: https://x-access-token:ghp_xxx@github.com → https://github.com
  return message.replace(/https:\/\/x-access-token:[^@]+@github\.com/g, 'https://github.com');
}
