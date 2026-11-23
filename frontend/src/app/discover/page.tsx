/**
 * Discover page — /discover
 *
 * Public creator discovery.  Available to fans, creators, and logged-out
 * visitors.  Fan accounts land here after onboarding (ADR-001 §2).
 *
 * Refs: #1828, ADR-001-role-model.md
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api/client';

interface Creator {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  subscriberCount?: number;
}

// The creators controller trims `q` and only searches when it is at least
// two characters (see backend/src/creators/creators.controller.ts) — firing
// a request for a single character would always be ignored server-side, so
// the input waits for a second character before searching.
const MIN_QUERY_LENGTH = 2;
// Debounce typing so each keystroke doesn't fire its own request.
const SEARCH_DEBOUNCE_MS = 300;

export default function DiscoverPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');

  // Debounce the raw input into an applied query. A single character never
  // becomes an applied query, since the API would ignore it anyway.
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed.length === 1) {
      return;
    }
    const timer = setTimeout(() => {
      setAppliedQuery(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const searchParam =
      appliedQuery.length >= MIN_QUERY_LENGTH ? `&q=${encodeURIComponent(appliedQuery)}` : '';

    apiFetch(`/api/v1/creators?limit=24${searchParam}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Server error: ${r.status}`);
        return r.json() as Promise<{ creators?: Creator[] }>;
      })
      .then((data) => {
        if (!cancelled) setCreators(data.creators ?? []);
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
  }, [appliedQuery]);

  const isSearching = appliedQuery.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    const cancel = load();
    return cancel;
  }, [load]);

  return (
    <main className="discover-page">
      <h1 className="discover-page__title">Discover Creators</h1>

      <div className="discover-page__search">
        <label htmlFor="discover-search" className="discover-page__search-label">
          Search creators
        </label>
        <input
          id="discover-search"
          type="search"
          className="discover-page__search-input"
          placeholder="Search by name or handle…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {loading && (
        <p className="discover-page__status" role="status">
          Loading creators…
        </p>
      )}

      {!loading && error && (
        <>
          <p className="discover-page__error" role="alert">
            {error}
          </p>
          <button type="button" className="discover-page__retry" onClick={() => void load()}>
            Retry
          </button>
        </>
      )}

      {!loading && !error && creators.length === 0 && (
        <p className="discover-page__empty">
          {isSearching
            ? `No creators match "${appliedQuery}".`
            : 'No creators found yet. Check back soon!'}
        </p>
      )}

      {!loading && !error && creators.length > 0 && (
        <ul className="discover-page__grid" role="list">
          {creators.map((creator) => (
            <li key={creator.id} className="discover-page__card">
              <Link
                href={`/creator/${creator.handle}`}
                className="discover-page__card-link"
                aria-label={creator.displayName}
              >
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
                <span className="discover-page__username">@{creator.handle}</span>
                <span className="discover-page__count">
                  {(creator.subscriberCount ?? 0).toLocaleString()} subscribers
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
