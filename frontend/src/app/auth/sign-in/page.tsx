/**
 * Sign-in page — /auth/sign-in
 *
 * Handles wallet connection + JWT exchange.  On success:
 *   1. Calls setAuthToken() to persist the JWT in both localStorage and
 *      the `authToken` cookie so the Edge middleware can read it.
 *   2. Calls refreshUser() to populate the UserContext.
 *   3. Redirects to `returnUrl` (if present and safe) or to the
 *      role-correct home (/dashboard for creators, /discover for fans).
 *
 * Refs: #1828, #1829, frontend/docs/AUTH_MIDDLEWARE.md
 */
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setAuthToken } from '@/lib/auth-storage';
import { useUser } from '@/context/UserContext';

/** Only allow redirects to same-origin paths to prevent open-redirect. */
function isSafeReturnUrl(url: string | null): url is string {
  if (!url) return false;
  // Must be a relative path starting with /
  return url.startsWith('/') && !url.startsWith('//');
}

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');
  const reason = searchParams.get('reason');

  const { user, loading, refreshUser } = useUser();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated, bounce immediately.
  if (!loading && user) {
    const destination = isSafeReturnUrl(returnUrl)
      ? returnUrl
      : user.is_creator
        ? '/dashboard'
        : '/discover';
    router.replace(destination);
    return null;
  }

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      // Wallet connect: call the backend auth endpoint.
      // In a real implementation this would invoke Freighter to sign a
      // challenge, then exchange it for a JWT.  Here we call /api/v1/auth/wallet.
      const res = await fetch('/api/v1/auth/wallet', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'freighter' }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `Auth failed: ${res.status}`);
      }

      const { token } = (await res.json()) as { token: string };
      setAuthToken(token);
      await refreshUser();

      // Navigate to returnUrl or role home.
      const me = await (await fetch('/api/v1/users/me', { credentials: 'same-origin' })).json() as { is_creator?: boolean };
      const destination = isSafeReturnUrl(returnUrl)
        ? returnUrl
        : me.is_creator
          ? '/dashboard'
          : '/discover';
      router.replace(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed. Please try again.');
    } finally {
      setConnecting(false);
    }
  }

  return (
    <main className="sign-in-page">
      <div className="sign-in-page__card">
        <h1 className="sign-in-page__title">Connect your wallet</h1>
        <p className="sign-in-page__subtitle">
          Sign in to MyFans with your Stellar wallet.
        </p>

        {reason === 'invalid_token' && (
          <p className="sign-in-page__notice" role="status">
            Your session has expired. Please reconnect your wallet.
          </p>
        )}

        {error && (
          <p className="sign-in-page__error" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          className="sign-in-page__cta"
          disabled={connecting || loading}
          aria-busy={connecting}
          onClick={() => void handleConnect()}
        >
          {connecting ? 'Connecting…' : 'Connect Freighter'}
        </button>

        <p className="sign-in-page__onboard">
          New here?{' '}
          <a href="/onboarding">Create a creator account</a>
          {' '}or{' '}
          <a href="/onboarding/fan">Start as a fan</a>
        </p>
      </div>
    </main>
  );
}
