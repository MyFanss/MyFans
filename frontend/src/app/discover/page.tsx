import type { Metadata } from 'next';
import DiscoverContent from "./DiscoverContent";

export const metadata: Metadata = {
  title: 'Discover Creators | MyFans',
  description: 'Find and subscribe to creators on MyFans — decentralized subscriptions built on Stellar.',
  openGraph: {
    title: 'Discover Creators | MyFans',
    description: 'Find and subscribe to creators on MyFans — decentralized subscriptions built on Stellar.',
    url: 'https://myfans.app/discover',
    siteName: 'MyFans',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Discover Creators | MyFans',
    description: 'Find and subscribe to creators on MyFans — decentralized subscriptions built on Stellar.',
  },
  alternates: { canonical: 'https://myfans.app/discover' },
};

export default function DiscoverPage() {
  return <DiscoverContent />;
}
