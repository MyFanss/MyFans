/**
 * Discover page — /discover
 *
 * Public creator discovery.  Available to fans, creators, and logged-out
 * visitors.  Fan accounts land here after onboarding (ADR-001 §2).
 *
 * Refs: #1828, ADR-001-role-model.md
 */
'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api/client';

interface Creator {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  subscriberCount: number;
}

export default function DiscoverPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/v1/creators?limit=24')
      .then((r) => r.json())
      .then((data: { data?: Creator[] }) => {
        if (!cancelled) setCreators(data.data ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load creators.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="discover-page">
      <h1 className="discover-page__title">Discover Creators</h1>

      {loading && (
        <p className="discover-page__status" role="status">
          Loading creators…
        </p>
      )}

      {!loading && error && (
        <p className="discover-page__error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && creators.length === 0 && (
        <p className="discover-page__empty">No creators found yet. Check back soon!</p>
      )}

      {!loading && !error && creators.length > 0 && (
        <ul className="discover-page__grid" role="list">
          {creators.map((creator) => (
            <li key={creator.id} className="discover-page__card">
              <a href={`/creator/${creator.username}`} className="discover-page__card-link">
                {creator.avatarUrl && (
                  <img
                    src={creator.avatarUrl}
                    alt={`${creator.displayName} avatar`}
                    className="discover-page__avatar"
                    width={64}
                    height={64}
                  />
                )}
                <span className="discover-page__name">{creator.displayName}</span>
                <span className="discover-page__username">@{creator.username}</span>
                <span className="discover-page__count">
                  {creator.subscriberCount.toLocaleString()} subscribers
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
