import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

import { middleware } from './middleware';

vi.mock('@/lib/demo-routes', () => ({
  demoRoutesEnabled: vi.fn(() => false),
}));

import { demoRoutesEnabled } from '@/lib/demo-routes';

const demoRoutesEnabledMock = vi.mocked(demoRoutesEnabled);

function makeRequest(
  pathname: string,
  init?: { cookie?: string; authorization?: string },
): NextRequest {
  const request = new NextRequest(new URL(`https://example.test${pathname}`));
  if (init?.cookie) {
    request.cookies.set('authToken', init.cookie);
  }
  if (init?.authorization) {
    request.headers.set('Authorization', init.authorization);
  }
  return request;
}

describe('middleware', () => {
  beforeEach(() => {
    demoRoutesEnabledMock.mockReturnValue(false);
  });

  it('redirects a protected path without a token to /auth/sign-in with returnUrl and no-store', () => {
    const response = middleware(makeRequest('/dashboard'));

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).not.toBeNull();
    const redirectUrl = new URL(location as string);
    expect(redirectUrl.pathname).toBe('/auth/sign-in');
    expect(redirectUrl.searchParams.get('returnUrl')).toBe('/dashboard');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('passes through a protected path with an authToken cookie', () => {
    const response = middleware(makeRequest('/dashboard', { cookie: 'a.b.c' }));

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('passes through a protected path with only a Bearer Authorization header', () => {
    const response = middleware(
      makeRequest('/dashboard', { authorization: 'Bearer a.b.c' }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('passes through a public path without redirect', () => {
    const response = middleware(makeRequest('/discover'));

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('passes through a protected path ending in a public asset extension', () => {
    const response = middleware(makeRequest('/dashboard/logo.png'));

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('returns 404 for a demo route when demoRoutesEnabled() is false', () => {
    demoRoutesEnabledMock.mockReturnValue(false);
    const response = middleware(makeRequest('/demo'));

    expect(response.status).toBe(404);
  });

  it('sets X-Robots-Tag for a demo route when demoRoutesEnabled() is true', () => {
    demoRoutesEnabledMock.mockReturnValue(true);
    const response = middleware(makeRequest('/demo'));

    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });
});
