import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { FavoritesProvider } from '@/hooks/useFavorites';
import { NoFlashScript } from '@/components/NoFlashScript';
import { ToastProvider } from '@/components/ErrorToast';

export const metadata: Metadata = {
  title: 'MyFans - Decentralized Subscriptions',
  description: 'Built on Stellar',
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
          <FavoritesProvider>
            <ToastProvider>{children}</ToastProvider>
          </FavoritesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
