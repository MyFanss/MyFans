'use client';
import { useState, useId } from 'react';
import WalletConnect from '@/components/WalletConnect';
import { BookmarkButton } from '@/components/BookmarkButton';
import { CreatorCard } from '@/components/cards';
import { CardSkeletonGrid, EmptyState } from '@/components/ui/states';
import { useToast } from '@/contexts/ToastContext';
import { FeatureGate } from '@/components/FeatureGate';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { FeatureFlag } from '@/lib/feature-flags';
import { getWalletSession, setSubscriptionStatusForCreator } from '@/lib/client-session';

interface Creator {
  id: string;
  name: string;
  username: string;
  bio: string;
  subscriptionPrice: number;
  subscriberCount: number;
}

type SubscribeState = 'idle' | 'loading' | 'subscribed' | 'error';
type UnlockState = 'locked' | 'loading' | 'unlocked' | 'error';

export default function SubscribePage() {
  const [query, setQuery] = useState('');
  const [isLoadingCreators] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState<string | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const { showError, showSuccess } = useToast();
  
  useEffect(() => {
    const session = getWalletSession();
    setConnectedAddress(session?.address ?? null);
  }, []);
  const isNewSubscriptionFlowEnabled = useFeatureFlag(FeatureFlag.NEW_SUBSCRIPTION_FLOW);

  const filteredCreators = useMemo(
    () => CREATOR_DATA.filter((c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.username.toLowerCase().includes(query.toLowerCase())
    ),
    [query]
  );
  const handleSubscribe = async (creator: Creator) => {
    if (!isNewSubscriptionFlowEnabled) {
      showError('SUBSCRIPTION_FLOW_DISABLED', {
        message: 'New subscription checkout is disabled.',
        description: 'This flow is controlled by a feature flag and is not currently available.',
      });
      return;
    }

    if (!connectedAddress) {
      showError('WALLET_CONNECTION_REQUIRED', {
        message: 'Connect your wallet first',
        description: 'Wallet connection is required before subscribing.',
      });
      return;
    }
  };

  const handleUnlock = async () => {
    setUnlockState('loading');
    try {
      await new Promise((r) => setTimeout(r, 500));
      setUnlockState('unlocked');
    } catch {
      setUnlockState('error');
    }
  };

  return (
    <div className="min-h-screen p-8">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded z-50"
      >
        Skip to main content
      </a>

      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Subscribe to Creators</h1>
        <WalletConnect />
      </header>

      <div className="mx-auto max-w-5xl space-y-6">
        {!isNewSubscriptionFlowEnabled && (
          <section className="rounded-xl border border-orange-200 bg-orange-50 p-5 text-orange-900">
            <h2 className="text-lg font-semibold">Subscription flow unavailable</h2>
            <p className="mt-1 text-sm">
              The new subscription checkout flow is currently disabled by feature flag. Please try again later.
            </p>
          </section>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Find a Creator</h2>
          <p className="mt-1 text-sm text-slate-600">Browse current creators and start supporting your favorites.</p>

            <button
              onClick={handleSubscribeClick}
              disabled={!creator.trim() || subscribeState === 'loading'}
              aria-busy={subscribeState === 'loading'}
              className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {subscribeState === 'loading' ? 'Subscribing…' : 'Subscribe'}
            </button>

            <div id={statusId} role="status" aria-live="polite" className="text-sm">
              {subscribeState === 'subscribed' && (
                <p className="text-green-600">✓ Subscribed successfully!</p>
              )}
              {subscribeState === 'error' && (
                <p role="alert" className="text-red-600">{errorMsg}</p>
              )}
            </div>
          </div>
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
                      disabled={
                        isSubscribing === creator.id ||
                        !connectedAddress ||
                        !isNewSubscriptionFlowEnabled
                      }
                      onClick={() => handleSubscribe(creator)}
                      type="button"
                    >
                      {isSubscribing === creator.id
                        ? 'Subscribing...'
                        : isNewSubscriptionFlowEnabled
                        ? 'Subscribe'
                        : 'Subscription disabled'}
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
          </section>
        )}
      </main>

      {/* Confirm subscribe modal with focus trap */}
      <Modal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title="Confirm Subscription"
      >
        <p className="mb-4 text-sm text-gray-600">
          Subscribe to <span className="font-mono font-medium">{creator}</span>?
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setIsConfirmOpen(false)}
            className="px-4 py-2 border rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmSubscribe}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            Confirm
          </button>
        </div>
      </Modal>
    </div>
  );
}
