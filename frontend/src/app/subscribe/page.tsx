'use client';
import { useState, useId } from 'react';
import WalletConnect from '@/components/WalletConnect';
import { Modal } from '@/components/Modal';

type SubscribeState = 'idle' | 'loading' | 'subscribed' | 'error';
type UnlockState = 'locked' | 'loading' | 'unlocked' | 'error';

export default function SubscribePage() {
  const [creator, setCreator] = useState('');
  const [subscribeState, setSubscribeState] = useState<SubscribeState>('idle');
  const [unlockState, setUnlockState] = useState<UnlockState>('locked');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const creatorInputId = useId();
  const statusId = useId();

  const handleSubscribeClick = () => {
    if (!creator.trim()) return;
    setIsConfirmOpen(true);
  };

  const handleConfirmSubscribe = async () => {
    setIsConfirmOpen(false);
    setSubscribeState('loading');
    setErrorMsg('');
    try {
      // Simulate contract call
      await new Promise((r) => setTimeout(r, 500));
      setSubscribeState('subscribed');
    } catch {
      setSubscribeState('error');
      setErrorMsg('Subscription failed. Please try again.');
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

      <main id="main-content" className="max-w-2xl mx-auto">
        <section aria-labelledby="subscribe-heading">
          <h2 id="subscribe-heading" className="text-xl mb-4">Find a Creator</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor={creatorInputId} className="block text-sm font-medium mb-1">
                Creator Stellar Address
              </label>
              <input
                id={creatorInputId}
                type="text"
                placeholder="G..."
                value={creator}
                onChange={(e) => setCreator(e.target.value)}
                aria-describedby={statusId}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

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

        {/* Unlock content section */}
        {subscribeState === 'subscribed' && (
          <section aria-labelledby="content-heading" className="mt-8">
            <h2 id="content-heading" className="text-xl mb-4">Exclusive Content</h2>
            <div className="border rounded p-4">
              <p className="mb-3 text-sm text-gray-600">
                {unlockState === 'unlocked'
                  ? 'Content unlocked! Enjoy your exclusive access.'
                  : 'This content is available to subscribers.'}
              </p>
              {unlockState !== 'unlocked' && (
                <button
                  onClick={handleUnlock}
                  disabled={unlockState === 'loading'}
                  aria-busy={unlockState === 'loading'}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {unlockState === 'loading' ? 'Unlocking…' : 'Unlock Content'}
                </button>
              )}
              {unlockState === 'error' && (
                <p role="alert" className="mt-2 text-sm text-red-600">
                  Failed to unlock. Please try again.
                </p>
              )}
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
