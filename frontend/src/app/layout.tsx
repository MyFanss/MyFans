import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { FavoritesProvider } from '@/hooks/useFavorites';
import { NoFlashScript } from '@/components/NoFlashScript';
import { ToastProvider } from '@/contexts/ToastContext';
import { ToastContainer } from '@/components/ui/Toast';
import NavLayout from '@/components/navigation/NavLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const metadata: Metadata = {
  title: {
    default: 'MyFans - Decentralized Subscriptions',
    template: '%s | MyFans'
  },
  description: 'Connect with your favorite creators through decentralized subscription platform built on Stellar. Support creators directly with crypto subscriptions.',
  keywords: ['decentralized', 'subscriptions', 'creators', 'stellar', 'crypto', 'fan club', 'exclusive content'],
  authors: [{ name: 'MyFans Team' }],
  creator: 'MyFans',
  publisher: 'MyFans',
  metadataBase: new URL('https://myfans.app'),
  openGraph: {
    title: 'MyFans - Decentralized Subscriptions',
    description: 'Connect with your favorite creators through decentralized subscription platform built on Stellar.',
    url: 'https://myfans.app',
    siteName: 'MyFans',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'MyFans - Decentralized Subscriptions',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MyFans - Decentralized Subscriptions',
    description: 'Connect with your favorite creators through decentralized subscription platform built on Stellar.',
    images: ['/og-image.jpg'],
    site: '@myfans',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <NoFlashScript />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>
            {children}
            <ToastContainer />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
