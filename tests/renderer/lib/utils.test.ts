import { describe, it, expect } from 'vitest';
import { cn } from '../../../src/renderer/lib/utils';

describe('cn() utility', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('handles undefined and null values', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end');
  });

  it('deduplicates conflicting Tailwind classes', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('handles empty input', () => {
    expect(cn()).toBe('');
  });

  it('handles array inputs', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('handles object inputs', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
  });

  it('merges Tailwind color variants correctly', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });
});
