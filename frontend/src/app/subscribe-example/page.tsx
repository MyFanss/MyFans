'use client';

import { FeatureFlag } from '@/components/FeatureFlag';

export default function SubscribeExample() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Subscribe</h1>

      <div className="mb-8">
        <h2 className="text-xl mb-2">Standard Subscription</h2>
        <button className="bg-blue-500 text-white px-4 py-2 rounded">
          Subscribe Now
        </button>
      </div>

      <FeatureFlag feature="newSubscriptionFlow">
        <div className="mb-8 border-2 border-green-500 p-4 rounded">
          <h2 className="text-xl mb-2">New Enhanced Flow</h2>
          <button className="bg-green-500 text-white px-4 py-2 rounded">
            Try New Flow
          </button>
        </div>
      </FeatureFlag>

      <FeatureFlag
        feature="cryptoPayments"
        fallback={<p className="text-gray-500">Crypto payments coming soon!</p>}
      >
        <div className="border-2 border-purple-500 p-4 rounded">
          <h2 className="text-xl mb-2">Pay with Crypto</h2>
          <button className="bg-purple-500 text-white px-4 py-2 rounded">
            Pay with XLM
          </button>
        </div>
      </FeatureFlag>
    </div>
  );
}
