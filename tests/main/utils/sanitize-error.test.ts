import { describe, it, expect } from 'vitest';
import { sanitizeGitError } from '../../../src/main/utils/sanitize-error';

describe('sanitizeGitError', () => {
  it('strips x-access-token from github.com URL', () => {
    const input = 'fatal: https://x-access-token:ghp_abc123@github.com not found';
    expect(sanitizeGitError(input)).toBe('fatal: https://github.com not found');
  });

  it('strips token from full URL with path', () => {
    const input = 'remote: https://x-access-token:ghp_abc123@github.com/owner/repo.git not found';
    expect(sanitizeGitError(input)).toBe('remote: https://github.com/owner/repo.git not found');
  });

  it('handles multiple token occurrences in one message', () => {
    const input =
      'push https://x-access-token:ghp_111@github.com/a/b.git failed, ' +
      'pull https://x-access-token:ghp_222@github.com/c/d.git failed';
    expect(sanitizeGitError(input)).toBe(
      'push https://github.com/a/b.git failed, pull https://github.com/c/d.git failed'
    );
  });

  it('preserves non-token error content unchanged', () => {
    const input = 'fatal: repository not found';
    expect(sanitizeGitError(input)).toBe('fatal: repository not found');
  });

  it('handles Error objects', () => {
    const error = new Error(
      'Failed to push: https://x-access-token:ghp_secret@github.com/org/repo.git'
    );
    expect(sanitizeGitError(error)).toBe('Failed to push: https://github.com/org/repo.git');
  });

  it('handles string inputs', () => {
    const input = 'https://x-access-token:ghp_token@github.com/owner/repo';
    expect(sanitizeGitError(input)).toBe('https://github.com/owner/repo');
  });

  it('handles undefined input gracefully', () => {
    expect(sanitizeGitError(undefined)).toBe('undefined');
  });

  it('handles null input gracefully', () => {
    expect(sanitizeGitError(null)).toBe('null');
  });

  it('handles object input gracefully', () => {
    expect(sanitizeGitError({ code: 128 })).toBe('[object Object]');
  });
});
