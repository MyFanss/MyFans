import { notFound } from 'next/navigation';
import { WalletModalDemo } from '@/components/wallet/WalletModalDemo';

export default function WalletDemoPage() {
  // Env gate: disable in production
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="relative min-h-screen">
      {/* Non-production banner */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-amber-500 text-black px-4 py-2 text-center text-sm font-semibold tracking-wide shadow-md">
        ⚠️ NON-PRODUCTION DEMO: This is a test environment for wallet connections. Do not use real funds.
      </div>
      <WalletModalDemo />
    </div>
  );
}
