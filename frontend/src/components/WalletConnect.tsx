'use client';
import { useState } from 'react';
import { connectWallet } from '@/lib/wallet';

export default function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null);

  const handleConnect = async () => {
    const addr = await connectWallet();
    if (addr) setAddress(addr);
  };

  return (
    <div className="p-4">
      {!address ? (
        <button onClick={handleConnect} className="px-4 py-2 bg-blue-600 text-white rounded">
          Connect Wallet
        </button>
      ) : (
        <div className="text-sm">Connected: {address.slice(0, 8)}...{address.slice(-8)}</div>
      )}
    </div>
  );
}
