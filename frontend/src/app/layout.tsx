import type { Metadata } from 'next';
import './globals.css';
import NavLayout from '@/components/navigation/NavLayout';

export const metadata: Metadata = {
  title: 'MyFans - Decentralized Subscriptions',
  description: 'Built on Stellar',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavLayout>{children}</NavLayout>
      </body>
    </html>
  );
}
