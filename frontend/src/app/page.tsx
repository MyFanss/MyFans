import WalletConnect from '@/components/WalletConnect';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen p-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">MyFans</h1>
        <WalletConnect />
      </header>
      
      <main className="max-w-4xl mx-auto">
        <h2 className="text-2xl mb-4">Decentralized Content Subscription Platform</h2>
        <p className="mb-6">Built on Stellar with Soroban smart contracts</p>
        
        <div className="grid grid-cols-2 gap-4">
          <Link href="/creators" className="p-6 border rounded hover:bg-gray-50">
            <h3 className="text-xl font-semibold mb-2">For Creators</h3>
            <p>Create subscription plans and monetize your content</p>
          </Link>
          
          <Link href="/subscribe" className="p-6 border rounded hover:bg-gray-50">
            <h3 className="text-xl font-semibold mb-2">For Fans</h3>
            <p>Subscribe to your favorite creators</p>
          </Link>
        </div>
      </main>
    </div>
  );
}
