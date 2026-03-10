/**
 * NpmRegistryService
 *
 * Searches the npm registry for packages using the public search API.
 * Uses native fetch() — no extra dependencies.
 */

import type { NpmSearchResult } from '../ipc/channels/types';

const REGISTRY_SEARCH_URL = 'https://registry.npmjs.org/-/v1/search';
const DEFAULT_SIZE = 10;
const TIMEOUT_MS = 5000;

interface NpmSearchObject {
  package: {
    name: string;
    description?: string;
    version: string;
    date?: string;
  };
}

interface NpmSearchResponse {
  objects: NpmSearchObject[];
}

export class NpmRegistryService {
  async search(query: string, size: number = DEFAULT_SIZE): Promise<NpmSearchResult[]> {
    if (!query.trim()) return [];

    try {
      const url = `${REGISTRY_SEARCH_URL}?text=${encodeURIComponent(query)}&size=${size}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) return [];

      const data = (await response.json()) as NpmSearchResponse;

      return (data.objects ?? []).map((obj) => ({
        name: obj.package.name,
        description: obj.package.description ?? '',
        version: obj.package.version,
        date: obj.package.date ?? '',
      }));
    } catch {
      return [];
    }
  }
}

export const npmRegistryService = new NpmRegistryService();
