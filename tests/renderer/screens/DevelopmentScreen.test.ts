import { describe, it, expect, vi } from 'vitest';

// Mock transitive dependencies pulled in via DevelopmentScreen → PullRequestDetailModal
vi.mock('react-markdown', () => ({
  default: () => null,
}));

vi.mock('lucide-react', async () => import('../../mocks/lucide-react'));

import { extractOwnerRepo } from '../../../src/renderer/screens/DevelopmentScreen';

describe('extractOwnerRepo', () => {
  it('parses HTTPS URL', () => {
    expect(extractOwnerRepo('https://github.com/facebook/react')).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
  });

  it('parses HTTPS URL with .git suffix', () => {
    expect(extractOwnerRepo('https://github.com/facebook/react.git')).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
  });

  it('parses SSH URL', () => {
    expect(extractOwnerRepo('git@github.com:facebook/react.git')).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
  });

  it('parses SSH URL without .git suffix', () => {
    expect(extractOwnerRepo('git@github.com:facebook/react')).toEqual({
      owner: 'facebook',
      repo: 'react',
    });
  });

  it('handles repo names with dots', () => {
    expect(extractOwnerRepo('https://github.com/user/my.repo.name')).toEqual({
      owner: 'user',
      repo: 'my.repo.name',
    });
  });

  it('handles owner and repo with hyphens', () => {
    expect(extractOwnerRepo('https://github.com/my-org/my-repo')).toEqual({
      owner: 'my-org',
      repo: 'my-repo',
    });
  });

  it('returns null for non-GitHub URL', () => {
    expect(extractOwnerRepo('https://gitlab.com/user/repo')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractOwnerRepo('')).toBeNull();
  });

  it('returns null for trailing slash', () => {
    expect(extractOwnerRepo('https://github.com/user/repo/')).toBeNull();
  });

  it('returns null for URL with query string', () => {
    expect(extractOwnerRepo('https://github.com/user/repo?tab=issues')).toBeNull();
  });
});
