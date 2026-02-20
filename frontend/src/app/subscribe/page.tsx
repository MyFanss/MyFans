'use client';
import { useState } from 'react';
import WalletConnect from '@/components/WalletConnect';

export default function SubscribePage() {
  const [creator, setCreator] = useState('');

  const handleSubscribe = async () => {
    alert(`Subscribing to ${creator}`);
  };

  return (
    <div className="min-h-screen p-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Subscribe to Creators</h1>
        <WalletConnect />
      </header>

      <div className="max-w-2xl mx-auto">
        <h2 className="text-xl mb-4">Find a Creator</h2>
        
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Creator Stellar address"
            value={creator}
            onChange={(e) => setCreator(e.target.value)}
            className="w-full p-2 border rounded"
          />
          
          <button
            onClick={handleSubscribe}
            className="w-full px-4 py-2 bg-green-600 text-white rounded"
          >
            Subscribe
          </button>
        </div>
      </div>
    </div>
  );
}
