// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  NpmRegistryService,
  npmRegistryService,
} from '../../../src/main/services/npm-registry.service';

const mockFetch = vi.fn();

describe('NpmRegistryService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns search results mapped to NpmSearchResult[]', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          objects: [
            {
              package: {
                name: 'express',
                description: 'Web framework',
                version: '4.18.2',
                date: '2023-10-01',
              },
            },
            {
              package: {
                name: 'koa',
                description: 'Koa web framework',
                version: '2.14.2',
                date: '2023-09-15',
              },
            },
          ],
        }),
    });

    const results = await npmRegistryService.search('express');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('https://registry.npmjs.org/-/v1/search');
    expect(url).toContain('text=express');
    expect(url).toContain('size=10');

    expect(results).toEqual([
      { name: 'express', description: 'Web framework', version: '4.18.2', date: '2023-10-01' },
      { name: 'koa', description: 'Koa web framework', version: '2.14.2', date: '2023-09-15' },
    ]);
  });

  it('uses custom size parameter', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ objects: [] }),
    });

    await npmRegistryService.search('test', 5);

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('size=5');
  });

  it('returns empty array for empty query', async () => {
    const results = await npmRegistryService.search('');
    expect(results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns empty array for whitespace-only query', async () => {
    const results = await npmRegistryService.search('   ');
    expect(results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns empty array when response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const results = await npmRegistryService.search('express');
    expect(results).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const results = await npmRegistryService.search('express');
    expect(results).toEqual([]);
  });

  it('returns empty array on abort (timeout)', async () => {
    mockFetch.mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    const results = await npmRegistryService.search('express');
    expect(results).toEqual([]);
  });

  it('handles missing optional fields gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          objects: [
            {
              package: {
                name: 'minimal-pkg',
                version: '0.1.0',
              },
            },
          ],
        }),
    });

    const results = await npmRegistryService.search('minimal');

    expect(results).toEqual([{ name: 'minimal-pkg', description: '', version: '0.1.0', date: '' }]);
  });

  it('handles null objects array gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const results = await npmRegistryService.search('test');
    expect(results).toEqual([]);
  });

  it('passes abort signal to fetch', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ objects: [] }),
    });

    await npmRegistryService.search('test');

    const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit;
    expect(fetchOptions.signal).toBeInstanceOf(AbortSignal);
  });

  it('exports a singleton instance', () => {
    expect(npmRegistryService).toBeInstanceOf(NpmRegistryService);
  });
});
