import type { Metadata } from 'next';
import { createBaseMetadata } from '@/lib/metadata';
import { HomeContent } from './HomeContent';

export const metadata: Metadata = createBaseMetadata({
  title: 'Home',
  description: 'Welcome to MyFans - the decentralized subscription platform built on Stellar. Support your favorite creators directly with crypto subscriptions and get exclusive content.',
  keywords: ['myfans', 'decentralized', 'subscriptions', 'stellar', 'crypto', 'creators', 'exclusive content'],
  url: 'https://myfans.app',
});

export default function Home() {
  return (
    <main id="main-content">
      <HomeContent />
    </main>
  );
}
