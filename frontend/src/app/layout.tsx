import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MyFans',
  description: 'Decentralized content subscription platform on Stellar',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
