import { describe, it, expect, afterEach } from 'vitest';
import { getApiBaseUrl } from './base-url';

const ENV_KEY = 'NEXT_PUBLIC_API_URL';

describe('getApiBaseUrl', () => {
  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  it('falls back to localhost when the env var is unset', () => {
    delete process.env[ENV_KEY];
    expect(getApiBaseUrl()).toBe('http://localhost:3001');
  });

  it('falls back to localhost when the env var is an empty string', () => {
    process.env[ENV_KEY] = '';
    expect(getApiBaseUrl()).toBe('http://localhost:3001');
  });

  it('falls back to localhost when the env var is whitespace-only', () => {
    process.env[ENV_KEY] = '   ';
    expect(getApiBaseUrl()).toBe('http://localhost:3001');
  });

  it('returns the trimmed value when configured', () => {
    process.env[ENV_KEY] = '  https://api.example.com  ';
    expect(getApiBaseUrl()).toBe('https://api.example.com');
  });

  it('strips a single trailing slash', () => {
    process.env[ENV_KEY] = 'https://api.example.com/';
    expect(getApiBaseUrl()).toBe('https://api.example.com');
  });

  it('preserves an internal path segment when stripping the trailing slash', () => {
    process.env[ENV_KEY] = 'https://api.example.com/v1/';
    expect(getApiBaseUrl()).toBe('https://api.example.com/v1');
  });
});
