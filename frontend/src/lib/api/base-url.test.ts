import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_API_BASE_URL,
  getApiBaseUrl,
  getConfiguredApiBaseUrl,
  getVersionedApiBaseUrl,
  trimTrailingSlash,
} from './base-url';

describe('api/base-url', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('trimTrailingSlash removes trailing slashes', () => {
    expect(trimTrailingSlash('http://localhost:3001/')).toBe('http://localhost:3001');
  });

  it('getApiBaseUrl defaults to localhost:3001', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    expect(getConfiguredApiBaseUrl()).toBeUndefined();
    expect(getApiBaseUrl()).toBe(DEFAULT_API_BASE_URL);
  });

  it('getVersionedApiBaseUrl uses same-origin /api/v1 when unset', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    expect(getVersionedApiBaseUrl()).toBe('/api/v1');
  });

  it('getVersionedApiBaseUrl appends /v1 to a Nest origin', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3001');
    expect(getVersionedApiBaseUrl()).toBe('http://localhost:3001/v1');
  });

  it('getVersionedApiBaseUrl respects an existing /api/v1 suffix', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://gateway.example/api/v1');
    expect(getVersionedApiBaseUrl()).toBe('https://gateway.example/api/v1');
  });

  it('getVersionedApiBaseUrl appends /v1 when base ends with /api', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://gateway.example/api');
    expect(getVersionedApiBaseUrl()).toBe('https://gateway.example/api/v1');
  });
});
