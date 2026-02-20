import Benefits from '@/components/Benefits';
import FeaturedCreators from '@/components/FeaturedCreators';
import TrustIndicators from '@/components/TrustIndicators';

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <main className="w-full">
        <section className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h1 className="text-5xl font-bold mb-6">MyFans</h1>
          <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-8 max-w-2xl mx-auto">
            Decentralized content subscriptions on Stellar. Instant payments, low fees, multi-currency support.
          </p>
          <div className="flex gap-4 justify-center">
            <a href="/creators" className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:opacity-90">
              Start Creating
            </a>
            <a href="/explore" className="px-6 py-3 border border-zinc-300 dark:border-zinc-700 rounded-lg font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900">
              Explore Creators
            </a>
          </div>
        </section>
        <Benefits />
        <FeaturedCreators />
        <TrustIndicators />
      </main>
    </div>
  );
}
