/**
 * Onboarding — creator / fan / both role selection.
 *
 * This is the entry-point onboarding page.  It:
 *   1. Asks the user to pick a role (creator, fan, or both).
 *   2. Persists the role via PATCH /api/v1/users/me (persistRole).
 *   3. Deep-links to the role-correct dashboard after completion:
 *        creator / both → /dashboard
 *        fan            → /discover
 *
 * Refresh-safe: if the page is reloaded mid-onboarding, the user lands
 * back on this page (step is not lost because nothing is committed until
 * the final CTA is clicked).
 *
 * Refs: #1828, frontend/docs/ADR-001-role-model.md
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { persistRole, type RoleIntent } from '@/lib/users-api';
import { useUser } from '@/context/UserContext';

const ROLES: { intent: RoleIntent; label: string; description: string }[] = [
  {
    intent: 'creator',
    label: 'Creator',
    description: 'Publish content, set subscription plans, and earn revenue.',
  },
  {
    intent: 'fan',
    label: 'Fan',
    description: 'Discover creators, subscribe to plans, and enjoy exclusive content.',
  },
  {
    intent: 'both',
    label: 'Both',
    description: 'Create content AND subscribe to other creators.',
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { refreshUser } = useUser();
  const [selected, setSelected] = useState<RoleIntent | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await persistRole(selected);
      await refreshUser();
      // Role-specific deep-link per ADR-001 §2
      const destination = selected === 'fan' ? '/discover' : '/dashboard';
      router.replace(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="onboarding-page">
      <div className="onboarding-page__card">
        <h1 className="onboarding-page__title">Welcome to MyFans</h1>
        <p className="onboarding-page__subtitle">How do you plan to use MyFans?</p>

        <ul
          className="onboarding-page__roles"
          role="radiogroup"
          aria-label="Select your role"
        >
          {ROLES.map(({ intent, label, description }) => (
            <li key={intent}>
              <button
                type="button"
                role="radio"
                aria-checked={selected === intent}
                className={`onboarding-page__role-btn${selected === intent ? ' onboarding-page__role-btn--selected' : ''}`}
                onClick={() => setSelected(intent)}
              >
                <span className="onboarding-page__role-label">{label}</span>
                <span className="onboarding-page__role-desc">{description}</span>
              </button>
            </li>
          ))}
        </ul>

        {error && (
          <p className="onboarding-page__error" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          className="onboarding-page__cta"
          disabled={!selected || saving}
          aria-busy={saving}
          onClick={() => void handleContinue()}
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </main>
  );
}
