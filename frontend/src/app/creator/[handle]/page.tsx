'use client';

import { useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api/client';

/**
 * Creator public profile — `/creator/[handle]`.
 *
 * Discover cards link here (frontend/src/app/discover/page.tsx). The route
 * is intentionally not listed in `PROTECTED_PREFIXES` in frontend/middleware.ts
 * so it stays reachable for logged-out fans (#2200).
 */

interface Creator {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  subscriberCount: number;
  isVerified: boolean;
}

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  interval: string;
  isActive: boolean;
}

export default function CreatorProfilePage({ params }: { params: { handle: string } }) {
  const { handle } = params;

  const [creator, setCreator] = useState<Creator | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [status, setStatus] = useState<'loading' | 'not_found' | 'error' | 'ready'>('loading');

  useEffect(() => {
    if (!handle) return;
    let cancelled = false;

    async function load() {
      try {
        // There is no "get creator by handle" endpoint; the list endpoint
        // already supports a `q` search (see backend/src/creators/creators.controller.ts
        // and #2201), so it is reused here and filtered to an exact handle match.
        const res = await apiFetch(`/api/v1/creators?limit=5&q=${encodeURIComponent(handle)}`);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const data = (await res.json()) as { creators?: Creator[] };
        const match = (data.creators ?? []).find((c) => c.handle === handle) ?? null;

        if (cancelled) return;

        if (!match) {
          setStatus('not_found');
          return;
        }
        setCreator(match);

        const plansRes = await apiFetch(`/api/v1/creators/${match.id}/plans`);
        if (!plansRes.ok) throw new Error(`Server error: ${plansRes.status}`);
        const plansData = (await plansRes.json()) as { plans?: Plan[] };

        if (cancelled) return;
        setPlans(plansData.plans ?? []);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  if (status === 'loading') {
    return (
      <main className="creator-profile">
        <p className="creator-profile__status" role="status">
          Loading creator…
        </p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="creator-profile">
        <p className="creator-profile__error" role="alert">
          Failed to load this creator. Please try again later.
        </p>
      </main>
    );
  }

  if (status === 'not_found' || !creator) {
    return (
      <main className="creator-profile">
        <p className="creator-profile__empty">Creator not found.</p>
      </main>
    );
  }

  return (
    <main className="creator-profile">
      <header className="creator-profile__header">
        {creator.avatarUrl && (
          <img
            src={creator.avatarUrl}
            alt={`${creator.displayName} avatar`}
            className="creator-profile__avatar"
            width={96}
            height={96}
          />
        )}
        <h1 className="creator-profile__name">{creator.displayName}</h1>
        <p className="creator-profile__handle">@{creator.handle}</p>
        {creator.bio && <p className="creator-profile__bio">{creator.bio}</p>}
        <p className="creator-profile__count">
          {creator.subscriberCount.toLocaleString()} subscribers
        </p>
      </header>

      <section className="creator-profile__plans" aria-label="Subscription plans">
        <h2>Plans</h2>
        {plans.length === 0 ? (
          <p className="creator-profile__plans-empty">No plans available yet.</p>
        ) : (
          <ul role="list" className="creator-profile__plans-list">
            {plans.map((plan) => (
              <li key={plan.id} className="creator-profile__plan">
                <span className="creator-profile__plan-name">{plan.name}</span>
                <span className="creator-profile__plan-price">
                  {plan.price} {plan.currency} / {plan.interval}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
