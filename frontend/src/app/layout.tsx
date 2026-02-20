import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyFans Settings",
  description: "Creator and fan settings for profile, wallet, notifications, and account management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
