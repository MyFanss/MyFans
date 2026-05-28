import type { Metadata } from 'next';
import './globals.css';
import { ErrorBoundary } from '@/components/error-boundary/ErrorBoundary';

export const metadata: Metadata = {
  title: 'MyFans - Decentralized Subscriptions',
  description: 'Built on Stellar',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary section="layout">
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
