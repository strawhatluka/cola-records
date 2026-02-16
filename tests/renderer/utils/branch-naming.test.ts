import { describe, it, expect } from 'vitest';
import { generateBranchName } from '../../../src/renderer/utils/branch-naming';

describe('generateBranchName', () => {
  // Label → prefix mapping
  it('maps "bug" label to fix/ prefix', () => {
    expect(generateBranchName({ number: 42, title: 'Fix crash', labels: ['bug'] })).toBe(
      'fix/42-fix-crash'
    );
  });

  it('maps "enhancement" label to feat/ prefix', () => {
    expect(
      generateBranchName({ number: 15, title: 'Add dark mode', labels: ['enhancement'] })
    ).toBe('feat/15-add-dark-mode');
  });

  it('maps "feature" label to feat/ prefix', () => {
    expect(generateBranchName({ number: 10, title: 'New widget', labels: ['feature'] })).toBe(
      'feat/10-new-widget'
    );
  });

  it('maps "documentation" label to docs/ prefix', () => {
    expect(
      generateBranchName({ number: 53, title: 'Update IPC guide', labels: ['documentation'] })
    ).toBe('docs/53-update-ipc-guide');
  });

  it('maps "docs" label to docs/ prefix', () => {
    expect(generateBranchName({ number: 53, title: 'Fix readme', labels: ['docs'] })).toBe(
      'docs/53-fix-readme'
    );
  });

  it('maps "refactor" label to refactor/ prefix', () => {
    expect(generateBranchName({ number: 31, title: 'Extract helper', labels: ['refactor'] })).toBe(
      'refactor/31-extract-helper'
    );
  });

  it('maps "hotfix" label to hotfix/ prefix', () => {
    expect(generateBranchName({ number: 99, title: 'Crash on startup', labels: ['hotfix'] })).toBe(
      'hotfix/99-crash-on-startup'
    );
  });

  it('maps "test" label to test/ prefix', () => {
    expect(generateBranchName({ number: 28, title: 'Edge cases', labels: ['test'] })).toBe(
      'test/28-edge-cases'
    );
  });

  it('maps "testing" label to test/ prefix', () => {
    expect(generateBranchName({ number: 28, title: 'Add unit tests', labels: ['testing'] })).toBe(
      'test/28-add-unit-tests'
    );
  });

  it('maps "chore" label to chore/ prefix', () => {
    expect(generateBranchName({ number: 70, title: 'Upgrade electron', labels: ['chore'] })).toBe(
      'chore/70-upgrade-electron'
    );
  });

  it('maps "dependencies" label to chore/ prefix', () => {
    expect(generateBranchName({ number: 70, title: 'Bump react', labels: ['dependencies'] })).toBe(
      'chore/70-bump-react'
    );
  });

  // Default prefix
  it('defaults to feat/ when no matching label', () => {
    expect(
      generateBranchName({ number: 7, title: 'Branch creation', labels: ['good first issue'] })
    ).toBe('feat/7-branch-creation');
  });

  it('defaults to feat/ when labels are empty', () => {
    expect(generateBranchName({ number: 1, title: 'Something new', labels: [] })).toBe(
      'feat/1-something-new'
    );
  });

  // Priority: bug wins over enhancement
  it('prioritizes "bug" over "enhancement" when both present', () => {
    expect(
      generateBranchName({ number: 5, title: 'Fix the toggle', labels: ['enhancement', 'bug'] })
    ).toBe('fix/5-fix-the-toggle');
  });

  // Title slugification
  it('lowercases and hyphenates the title', () => {
    expect(
      generateBranchName({ number: 1, title: 'Fix Player Position Parsing', labels: ['bug'] })
    ).toBe('fix/1-fix-player-position-parsing');
  });

  it('removes special characters from the title', () => {
    expect(
      generateBranchName({ number: 2, title: 'Fix: player position (bug)', labels: ['bug'] })
    ).toBe('fix/2-fix-player-position-bug');
  });

  it('collapses consecutive hyphens', () => {
    expect(generateBranchName({ number: 3, title: 'Fix -- double  dash', labels: ['bug'] })).toBe(
      'fix/3-fix-double-dash'
    );
  });

  it('removes leading and trailing hyphens from slug', () => {
    expect(
      generateBranchName({ number: 4, title: ' -Leading and trailing- ', labels: ['bug'] })
    ).toBe('fix/4-leading-and-trailing');
  });

  // Truncation to ~4 words
  it('truncates long titles to 4 words', () => {
    expect(
      generateBranchName({
        number: 5,
        title: 'Fix the very long issue title that keeps going',
        labels: ['bug'],
      })
    ).toBe('fix/5-fix-the-very-long');
  });

  // Empty title
  it('handles empty title gracefully', () => {
    expect(generateBranchName({ number: 6, title: '', labels: ['bug'] })).toBe('fix/6-untitled');
  });

  // Case-insensitive label matching
  it('matches labels case-insensitively', () => {
    expect(generateBranchName({ number: 7, title: 'Fix it', labels: ['Bug'] })).toBe(
      'fix/7-fix-it'
    );
  });
});
