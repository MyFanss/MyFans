import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { isStructurallyValidJwt, middleware } from '../../middleware';

function makeRequest(pathname: string, cookie?: string): NextRequest {
  const request = new NextRequest(new URL(`https://example.test${pathname}`));
  if (cookie !== undefined) {
    request.cookies.set('authToken', cookie);
  }
  return request;
}

describe('isStructurallyValidJwt', () => {
  it('accepts three non-empty dot-separated segments', () => {
    expect(isStructurallyValidJwt('aaa.bbb.ccc')).toBe(true);
  });

  it('rejects empty, one-, two-, and four-segment tokens', () => {
    expect(isStructurallyValidJwt('')).toBe(false);
    expect(isStructurallyValidJwt('abc')).toBe(false);
    expect(isStructurallyValidJwt('a.b')).toBe(false);
    expect(isStructurallyValidJwt('a.b.c.d')).toBe(false);
  });

  it('rejects tokens with empty segments', () => {
    expect(isStructurallyValidJwt('a..c')).toBe(false);
    expect(isStructurallyValidJwt('.b.c')).toBe(false);
    expect(isStructurallyValidJwt('a.b.')).toBe(false);
  });
});

describe('middleware', () => {
  it('redirects to sign-in with returnUrl and no-store when no token is present', () => {
    const response = middleware(makeRequest('/dashboard'));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.pathname).toBe('/auth/sign-in');
    expect(location.searchParams.get('returnUrl')).toBe('/dashboard');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('redirects when the token is a single segment', () => {
    const response = middleware(makeRequest('/dashboard', 'abc'));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.searchParams.get('returnUrl')).toBe('/dashboard');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('redirects when the token has two segments', () => {
    const response = middleware(makeRequest('/dashboard', 'a.b'));
    expect(response.status).toBe(307);
  });

  it('redirects when the token is an empty string', () => {
    const response = middleware(makeRequest('/dashboard', ''));
    expect(response.status).toBe(307);
  });

  it('passes through with a valid three-segment token', () => {
    const response = middleware(makeRequest('/dashboard', 'aaa.bbb.ccc'));
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('passes through public asset paths under a protected prefix', () => {
    const response = middleware(makeRequest('/dashboard/logo.png'));
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('passes through non-protected prefixes', () => {
    const response = middleware(makeRequest('/discover'));
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });
});
