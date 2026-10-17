/**
 * Fan onboarding quickstart — /onboarding/fan
 *
 * The short "wallet → browse → subscribe" path for fans.
 * Intentionally separate from /onboarding (the full creator setup):
 *   /onboarding/fan → sets is_creator = false → redirects to /discover
 *   /onboarding     → creator / both setup   → redirects to /dashboard
 *
 * Refs: #1828, frontend/docs/ADR-001-role-model.md §5
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { persistRole } from '@/lib/users-api';
import { useUser } from '@/context/UserContext';

export default function FanOnboardingPage() {
  const router = useRouter();
  const { refreshUser } = useUser();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGetStarted() {
    setSaving(true);
    setError(null);
    try {
      await persistRole('fan');
      await refreshUser();
      router.replace('/discover');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="onboarding-fan-page">
      <div className="onboarding-fan-page__card">
        <h1 className="onboarding-fan-page__title">Start as a Fan</h1>
        <p className="onboarding-fan-page__body">
          Connect your Stellar wallet, discover creators, and subscribe to exclusive content —
          all with low fees and instant settlement.
        </p>

        <ol className="onboarding-fan-page__steps" aria-label="Getting started steps">
          <li>Connect your Freighter wallet</li>
          <li>Discover creators you love</li>
          <li>Subscribe and unlock exclusive content</li>
        </ol>

        {error && (
          <p className="onboarding-fan-page__error" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          className="onboarding-fan-page__cta"
          disabled={saving}
          aria-busy={saving}
          onClick={() => void handleGetStarted()}
        >
          {saving ? 'Setting up…' : 'Get started as a Fan'}
        </button>

        <p className="onboarding-fan-page__switch">
          Want to publish content?{' '}
          <a href="/onboarding">Set up as a Creator instead</a>
        </p>
      </div>
    </main>
  );
}
