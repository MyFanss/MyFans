import { useState } from 'react';

interface WalletDisplayProps {
  address: string;
  network?: string;
  onDisconnect: () => void;
}

export default function WalletDisplay({ address, network = 'Mainnet', onDisconnect }: WalletDisplayProps) {
  const [copied, setCopied] = useState(false);

  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!address) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg" role="status" aria-live="polite">
        <span className="text-sm text-gray-600">Wallet disconnected</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg">
      <div className="flex flex-col">
        <span className="text-xs text-gray-500">{network}</span>
        <span className="text-sm font-mono font-medium" aria-label={`Wallet address ${address}`}>
          {formatAddress(address)}
        </span>
      </div>
      
      <button
        onClick={handleCopy}
        className="p-1.5 hover:bg-gray-100 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        aria-label={copied ? 'Address copied' : 'Copy address'}
      >
        {copied ? (
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>

      <button
        onClick={onDisconnect}
        className="ml-2 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
        aria-label="Disconnect wallet"
      >
        Disconnect
      </button>
    </div>
  );
}
