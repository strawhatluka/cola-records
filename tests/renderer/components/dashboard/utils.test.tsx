import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatRelativeTime,
  CI_STATUS_COLORS,
  CI_STATUS_DOT_COLORS,
} from '../../../../src/renderer/components/dashboard/utils';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-18T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for times less than a minute ago', () => {
    const thirtySecondsAgo = new Date('2026-02-18T11:59:30Z');
    expect(formatRelativeTime(thirtySecondsAgo)).toBe('just now');
  });

  it('returns minutes for times less than an hour ago', () => {
    const tenMinutesAgo = new Date('2026-02-18T11:50:00Z');
    expect(formatRelativeTime(tenMinutesAgo)).toBe('10m ago');
  });

  it('returns hours for times less than a day ago', () => {
    const threeHoursAgo = new Date('2026-02-18T09:00:00Z');
    expect(formatRelativeTime(threeHoursAgo)).toBe('3h ago');
  });

  it('returns days for times less than a month ago', () => {
    const fiveDaysAgo = new Date('2026-02-13T12:00:00Z');
    expect(formatRelativeTime(fiveDaysAgo)).toBe('5d ago');
  });

  it('returns months for times less than a year ago', () => {
    const twoMonthsAgo = new Date('2025-12-18T12:00:00Z');
    expect(formatRelativeTime(twoMonthsAgo)).toBe('2mo ago');
  });

  it('returns years for old dates', () => {
    const twoYearsAgo = new Date('2024-02-18T12:00:00Z');
    expect(formatRelativeTime(twoYearsAgo)).toBe('2y ago');
  });

  it('handles string dates', () => {
    expect(formatRelativeTime('2026-02-18T09:00:00Z')).toBe('3h ago');
  });

  it('returns "just now" for future dates', () => {
    const future = new Date('2026-02-18T13:00:00Z');
    expect(formatRelativeTime(future)).toBe('just now');
  });
});

describe('CI_STATUS_COLORS', () => {
  it('maps success to green', () => {
    expect(CI_STATUS_COLORS.success).toContain('green');
  });

  it('maps failure to red', () => {
    expect(CI_STATUS_COLORS.failure).toContain('red');
  });

  it('maps in_progress to yellow', () => {
    expect(CI_STATUS_COLORS.in_progress).toContain('yellow');
  });
});

describe('CI_STATUS_DOT_COLORS', () => {
  it('has dot color entries matching CI_STATUS_COLORS keys', () => {
    Object.keys(CI_STATUS_COLORS).forEach((key) => {
      expect(CI_STATUS_DOT_COLORS).toHaveProperty(key);
    });
  });
});
