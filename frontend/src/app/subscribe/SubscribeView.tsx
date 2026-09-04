'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import WalletConnect from '@/components/WalletConnect';
import { BookmarkButton } from '@/components/BookmarkButton';
import { CreatorCard } from '@/components/cards';
import { EmptyState } from '@/components/ui/states';
import { CreatorCardSkeleton } from '@/components/ui/CreatorCardSkeleton';
import { useToast } from '@/contexts/ToastContext';
import {
  loadFanQuickstartState,
  saveFanQuickstartState,
} from '@/lib/fan-quickstart';
import { searchCreators, type PublicCreator } from '@/lib/api/creators';

/** Debounce delay (ms) before firing the API search */
const SEARCH_DEBOUNCE_MS = 350;

export default function SubscribeView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fanQuickstart = searchParams.get('fanQuickstart') === '1';
  const { showError } = useToast();

  const [query, setQuery] = useState('');
  const [creators, setCreators] = useState<PublicCreator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Track the debounce timer so we can cancel it on unmount / new keystrokes.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Run a search against the API and update state accordingly. */
  const runSearch = useCallback(async (q: string) => {
    setIsLoading(true);
    setHasError(false);
    try {
      const result = await searchCreators({ q: q.trim() || undefined, limit: 24 });
      setCreators(result.data);
    } catch {
      setHasError(true);
      setCreators([]);
      showError('API_ERROR', {
        message: 'Could not load creators',
        description: 'Check your connection and try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  // On mount: mark fanQuickstart explore step, then run initial (empty) search.
  useEffect(() => {
    if (fanQuickstart) {
      const s = loadFanQuickstartState();
      saveFanQuickstartState({ ...s, explore: true });
    }
    void runSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce the query input so we don't hammer the API on every keystroke.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(query);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  /** Navigate to the confirmation page — plan selection happens there. */
  const handleSubscribe = (creator: PublicCreator) => {
    router.push(`/subscribe/${encodeURIComponent(creator.id)}/confirm`);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Subscribe to Creators
          </h1>
          {fanQuickstart ? (
            <p className="mt-1 text-sm text-sky-700 dark:text-sky-300">
              Quickstart: pick a creator and tap Subscribe.
            </p>
          ) : null}
        </div>
        <WalletConnect />
      </header>

      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Find a Creator</h2>
          <p className="mt-1 text-sm text-slate-600">Browse creators and start supporting your favorites.</p>

          <label htmlFor="creator-search" className="sr-only">
            Search creators
          </label>
          <input
            id="creator-search"
            aria-autocomplete="list"
            aria-controls="creator-results"
            aria-label="Search creators by name, handle, or bio"
            className="mt-4 w-full rounded border border-slate-300 p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, handle, or content"
            role="combobox"
            aria-expanded={!isLoading && creators.length > 0}
            type="search"
            value={query}
          />
        </section>

        <section id="creator-results" aria-live="polite" aria-atomic="false">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">
            {query.trim() ? `Results for "${query.trim()}"` : 'Available creators'}
          </h3>

          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading creators">
              {[...Array(3)].map((_, i) => (
                <CreatorCardSkeleton key={i} />
              ))}
            </div>
          ) : hasError ? (
            <EmptyState
              ctaLabel="Retry"
              description="Something went wrong while loading creators. Please try again."
              onCtaClick={() => void runSearch(query)}
              title="Failed to load creators"
            />
          ) : creators.length === 0 ? (
            <EmptyState
              ctaLabel="Clear search"
              description="Try a different keyword or clear your filter to see all creators."
              onCtaClick={() => setQuery('')}
              title="No creators matched your search"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {creators.map((creator) => (
                <CreatorCard
                  key={creator.id}
                  actionButton={
                    <button
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                      onClick={() => handleSubscribe(creator)}
                      type="button"
                    >
                      Subscribe
                    </button>
                  }
                  bio={creator.bio ?? ''}
                  headerAccessory={<BookmarkButton creatorId={creator.id} />}
                  name={creator.display_name}
                  subscriberCount={creator.followers_count ?? 0}
                  subscriptionPrice={
                    creator.subscription_price
                      ? parseFloat(String(creator.subscription_price))
                      : 0
                  }
                  username={creator.username}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
