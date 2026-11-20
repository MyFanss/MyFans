/**
 * Session cookie endpoint — /api/auth/session
 *
 * POST   { token }  → sets the `authToken` cookie as HttpOnly, so page scripts
 *                     cannot read the JWT. Edge middleware reads it from the
 *                     request cookie.
 * DELETE            → expires that cookie with the same attributes it was set with.
 *
 * Refs: #2185, frontend/docs/AUTH_MIDDLEWARE.md
 */
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AUTH_TOKEN_KEY } from '@/lib/auth-storage';

const MAX_TOKEN_LENGTH = 4096;

function sessionCookieOptions(maxAge?: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    ...(maxAge === undefined ? {} : { maxAge }),
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === 'string' ? body.token : '';
  // Minimal JWT shape check (header.payload.signature); the backend verifies the signature.
  const parts = token.split('.');
  if (token.length > MAX_TOKEN_LENGTH || parts.length !== 3 || parts.some((p) => !p)) {
    return NextResponse.json({ message: 'Invalid session token.' }, { status: 400 });
  }

  (await cookies()).set(AUTH_TOKEN_KEY, token, sessionCookieOptions());
  return new NextResponse(null, { status: 204 });
}

export async function DELETE() {
  (await cookies()).set(AUTH_TOKEN_KEY, '', sessionCookieOptions(0));
  return new NextResponse(null, { status: 204 });
}
