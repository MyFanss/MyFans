import type { Metadata } from 'next';
import { createBaseMetadata } from '@/lib/metadata';
import { Hero } from "@/components/landing";
import CreatorCardSkeleton from "@/components/ui/CreatorCardSkeleton";

export const metadata: Metadata = createBaseMetadata({
  title: 'Home',
  description: 'Welcome to MyFans - the decentralized subscription platform built on Stellar. Support your favorite creators directly with crypto subscriptions and get exclusive content.',
  keywords: ['myfans', 'decentralized', 'subscriptions', 'stellar', 'crypto', 'creators', 'exclusive content'],
  url: 'https://myfans.app',
});

export default function Home() {
  return (
    <>
      <Hero />


<CreatorCardSkeleton/>

      {/* Main content area with id for skip-to-content link */}
      <main id="main-content" className="min-h-screen">
        {/* Additional sections can be added here */}
      </main>
    </>
  );
}
