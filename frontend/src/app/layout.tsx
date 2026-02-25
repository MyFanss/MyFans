import type { Metadata } from 'next';
import './globals.css';
import NavLayout from '@/components/navigation/NavLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const metadata: Metadata = {
  title: 'MyFans - Decentralized Subscriptions',
  description: 'Built on Stellar',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <NavLayout>{children}</NavLayout>
        </ErrorBoundary>
      </body>
    </html>
  );
}
