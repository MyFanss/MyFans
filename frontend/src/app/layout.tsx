import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { NoFlashScript } from '@/components/NoFlashScript';
import { ToastProvider } from '@/components/ErrorToast';
import { ConsentProvider } from '@/contexts/ConsentContext';
import { ConsentBanner } from '@/components/ConsentBanner';
import NavLayout from '@/components/navigation/NavLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';

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
          <ConsentProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
            <ConsentBanner />
          </ConsentProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
