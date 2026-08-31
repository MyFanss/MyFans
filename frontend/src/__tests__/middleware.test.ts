/**
 * Tests for the Next.js server middleware (#1658).
 *
 * These tests verify the three acceptance criteria:
 *  1. Logged-out /dashboard (and other protected routes) redirects to /auth/sign-in.
 *  2. Public creator/discover routes return NextResponse.next() (200).
 *  3. The redirect URL is /auth/sign-in (not /auth/login).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock demo-routes so the middleware can be imported without the full Next.js
// build context.
vi.mock('@/lib/demo-routes', () => ({
  isDemoRoute: () => false,
  demoRoutesEnabled: () => false,
}));

// Import after mocks so they take effect.
import { middleware } from '../../middleware';

function makeRequest(pathname: string, cookies: Record<string, string> = {}, headers: Record<string, string> = {}) {
  const url = `http://localhost${pathname}`;
  const req = new NextRequest(url, {
    headers: {
      ...headers,
    },
  });
  // Set cookies by appending them to the Cookie header.
  const cookieString = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  if (cookieString) {
    const cloned = new NextRequest(url, {
      headers: {
        ...headers,
        cookie: cookieString,
      },
    });
    return cloned;
  }
  return req;
}

describe('middleware – protected routes redirect logged-out users', () => {
  it('redirects /dashboard to /auth/sign-in when no authToken cookie', () => {
    const res = middleware(makeRequest('/dashboard'));
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/auth/sign-in');
    expect(location).not.toContain('/auth/login');
  });

  it('redirects /dashboard/earnings to sign-in with returnUrl', () => {
    const res = middleware(makeRequest('/dashboard/earnings'));
    expect(res.status).toBe(307);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('/auth/sign-in');
    expect(location).toContain('returnUrl=%2Fdashboard%2Fearnings');
  });

  it('redirects /settings to sign-in', () => {
    const res = middleware(makeRequest('/settings'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/auth/sign-in');
  });

  it('redirects /messages to sign-in', () => {
    const res = middleware(makeRequest('/messages'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/auth/sign-in');
  });

  it('redirects /pending to sign-in (auth required)', () => {
    const res = middleware(makeRequest('/pending'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/auth/sign-in');
  });

  it('sets Cache-Control: no-store on redirect responses', () => {
    const res = middleware(makeRequest('/dashboard'));
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('middleware – authenticated requests pass through', () => {
  it('allows /dashboard when authToken cookie is present', () => {
    const res = middleware(makeRequest('/dashboard', { authToken: 'test-jwt' }));
    // NextResponse.next() has status 200
    expect(res.status).toBe(200);
  });

  it('allows /settings when Authorization header is present', () => {
    const res = middleware(
      makeRequest('/settings', {}, { authorization: 'Bearer my-token' }),
    );
    expect(res.status).toBe(200);
  });

  it('allows /messages when authToken cookie present', () => {
    const res = middleware(makeRequest('/messages', { authToken: 'abc' }));
    expect(res.status).toBe(200);
  });
});

describe('middleware – public routes are not protected', () => {
  it('passes through / (home) without auth', () => {
    const res = middleware(makeRequest('/'));
    expect(res.status).toBe(200);
  });

  it('passes through /discover without auth', () => {
    const res = middleware(makeRequest('/discover'));
    expect(res.status).toBe(200);
  });

  it('passes through /creator/alice without auth', () => {
    const res = middleware(makeRequest('/creator/alice'));
    expect(res.status).toBe(200);
  });

  it('passes through /auth/sign-in without auth', () => {
    const res = middleware(makeRequest('/auth/sign-in'));
    expect(res.status).toBe(200);
  });

  it('passes through /auth/sign-in even with no cookie', () => {
    const res = middleware(makeRequest('/auth/sign-in'));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });
});
