import type { Metadata } from 'next';
import { createBaseMetadata } from '@/lib/metadata';
import DiscoverContent from "./DiscoverContent";

export const metadata: Metadata = createBaseMetadata({
  title: 'Discover Creators',
  description: 'Explore and discover amazing creators on MyFans. Find exclusive content from artists, musicians, photographers, and more. Join the decentralized creator economy.',
  keywords: ['discover', 'creators', 'explore', 'find creators', 'exclusive content', 'subscriptions'],
  url: 'https://myfans.app/discover',
});

export default function DiscoverPage() {
  return <DiscoverContent />;
}
