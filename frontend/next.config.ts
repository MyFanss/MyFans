import type { NextConfig } from "next";
import { getRemoteImagePatterns } from "./src/lib/image-remote-patterns";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: getRemoteImagePatterns(),
  },
  // Ensure proper metadata handling for SSR/SSG
  experimental: {
    optimizeCss: true,
  },
  // Proper handling of metadata in static generation
  generateEtags: true,
  // Ensure proper headers for SEO
  async headers() {
    return [
      {
        source: '/creator/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
