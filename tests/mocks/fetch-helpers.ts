/**
 * Fetch Mock Helpers
 *
 * Utilities for mocking global fetch in service tests.
 * Provides chainable response builders and common response patterns.
 */
import { vi } from 'vitest';

interface MockResponseInit {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
}

/**
 * Creates a mock Response object matching the Fetch API shape.
 */
export function createMockResponse(body: unknown, init: MockResponseInit = {}): Response {
  const { status = 200, statusText = 'OK', headers = {} } = init;
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: new Headers({ 'content-type': 'application/json', ...headers }),
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    text: async () => bodyStr,
    blob: async () => new Blob([bodyStr]),
    clone: () => createMockResponse(body, init),
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    formData: async () => new FormData(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    bytes: async () => new Uint8Array(),
  } as Response;
}

/**
 * Creates a 200 OK response with JSON body.
 */
export function okResponse(body: unknown = {}): Response {
  return createMockResponse(body, { status: 200 });
}

/**
 * Creates a 201 Created response.
 */
export function createdResponse(body: unknown = {}): Response {
  return createMockResponse(body, { status: 201 });
}

/**
 * Creates a 204 No Content response.
 */
export function noContentResponse(): Response {
  return createMockResponse('', { status: 204 });
}

/**
 * Creates a 401 Unauthorized response.
 */
export function unauthorizedResponse(body: unknown = { message: 'Unauthorized' }): Response {
  return createMockResponse(body, { status: 401, statusText: 'Unauthorized' });
}

/**
 * Creates a 403 Forbidden response.
 */
export function forbiddenResponse(body: unknown = { message: 'Forbidden' }): Response {
  return createMockResponse(body, { status: 403, statusText: 'Forbidden' });
}

/**
 * Creates a 404 Not Found response.
 */
export function notFoundResponse(body: unknown = { message: 'Not Found' }): Response {
  return createMockResponse(body, { status: 404, statusText: 'Not Found' });
}

/**
 * Creates a 429 Rate Limited response with Retry-After header.
 */
export function rateLimitResponse(retryAfterSecs = 1): Response {
  return createMockResponse(
    { message: 'You are being rate limited.', retry_after: retryAfterSecs },
    {
      status: 429,
      statusText: 'Too Many Requests',
      headers: { 'Retry-After': String(retryAfterSecs) },
    }
  );
}

/**
 * Creates a 500 Internal Server Error response.
 */
export function serverErrorResponse(
  body: unknown = { message: 'Internal Server Error' }
): Response {
  return createMockResponse(body, { status: 500, statusText: 'Internal Server Error' });
}

/**
 * Sets up global.fetch as a vi.fn() mock. Returns the mock for assertion chaining.
 * Call in beforeEach; restore in afterEach via vi.restoreAllMocks().
 */
export function setupFetchMock(): ReturnType<typeof vi.fn> {
  const mockFetch = vi.fn();
  global.fetch = mockFetch;
  return mockFetch;
}
