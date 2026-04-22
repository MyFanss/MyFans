'use client';

import { useEffect, useMemo, useState } from 'react';
import WalletConnect from '@/components/WalletConnect';
import { BookmarkButton } from '@/components/BookmarkButton';
import { CreatorCard } from '@/components/cards';
import { CardSkeletonGrid, EmptyState } from '@/components/ui/states';
import { useToast } from '@/contexts/ToastContext';
import { FeatureGate } from '@/components/FeatureGate';
import { FeatureFlag } from '@/lib/feature-flags';

interface Creator {
  id: string;
  name: string;
  username: string;
  bio: string;
  subscriptionPrice: number;
  subscriberCount: number;
}

const CREATOR_DATA: Creator[] = [
  {
    id: 'c1',
    name: 'Lena Nova',
    username: 'lena.nova',
    bio: 'Daily music snippets and behind-the-scenes studio sessions.',
    subscriptionPrice: 8,
    subscriberCount: 1840,
  },
  {
    id: 'c2',
    name: 'Orion Pixel',
    username: 'orion.pixel',
    bio: 'Concept art tutorials, raw PSD files, and process walkthroughs.',
    subscriptionPrice: 12,
    subscriberCount: 962,
  },
  {
    id: 'c3',
    name: 'Vera Script',
    username: 'vera.script',
    bio: 'Writing prompts, serialized fiction, and monthly Q&A streams.',
    subscriptionPrice: 6,
    subscriberCount: 1513,
  },
];

export default function SubscribePage() {
  const [query, setQuery] = useState('');
  const [isLoadingCreators] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState<string | null>(null);
  const filteredCreators = useMemo(
    () => CREATOR_DATA.filter((c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.username.toLowerCase().includes(query.toLowerCase())
    ),
    [query]
  );
  const handleSubscribe = async (creator: Creator) => {
    setIsSubscribing(creator.id);
    try {
      // subscription logic handled by checkout flow
    } finally {
      setIsSubscribing(null);
    }
  };
  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Subscribe to Creators</h1>
        <WalletConnect />
      </header>

      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Find a Creator</h2>
          <p className="mt-1 text-sm text-slate-600">Browse current creators and start supporting your favorites.</p>

          <label htmlFor="creator-search" className="sr-only">
            Search creators
          </label>
          <input
            id="creator-search"
            className="mt-4 w-full rounded border border-slate-300 p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, handle, or content"
            type="text"
            value={query}
          />

        </section>

        <section>
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Available creators</h3>
          {isLoadingCreators ? (
            <CardSkeletonGrid count={3} />
          ) : filteredCreators.length === 0 ? (
            <EmptyState
              ctaLabel="Clear search"
              description="Try a different keyword or clear your filter to see all creators."
              onCtaClick={() => setQuery('')}
              title="No creators matched your search"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCreators.map((creator) => (
                <CreatorCard
                  actionButton={
                    <button
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
                      disabled={isSubscribing === creator.id}
                      onClick={() => handleSubscribe(creator)}
                      type="button"
                    >
                      {isSubscribing === creator.id ? 'Subscribing...' : 'Subscribe'}
                    </button>
                  }
                  bio={creator.bio}
                  key={creator.id}
                  headerAccessory={
                    <FeatureGate flag={FeatureFlag.BOOKMARKS}>
                      <BookmarkButton creatorId={creator.id} />
                    </FeatureGate>
                  }
                  name={creator.name}
                  subscriberCount={creator.subscriberCount}
                  subscriptionPrice={creator.subscriptionPrice}
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
