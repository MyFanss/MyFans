import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { getRemoteImagePatterns } from "./src/lib/image-remote-patterns";
import { getApiBaseUrl } from "./src/lib/api/base-url";
import { buildContentSecurityPolicy } from "./src/lib/csp";

const isProd = process.env.NODE_ENV === 'production';

// Builds the CSP header value, including connect-src hosts derived from
// NEXT_PUBLIC_SOROBAN_RPC_URL / NEXT_PUBLIC_HORIZON_URL. See src/lib/csp.ts
// and docs/CSP.md for the full host list and how to update it.
function getCSP() {
  const apiHost = new URL(getApiBaseUrl()).host;
  return buildContentSecurityPolicy({ apiHost, isProd });
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: getRemoteImagePatterns(),
  },
  experimental: {
    optimizeCss: true,
  },
  generateEtags: true,
  /**
   * Proxy same-origin `/api/v1/*` to the Nest backend's `/v1/*`.
   * Pages and clients that fetch `/api/v1/...` hit Nest in local/dev without CORS.
   * Destination host comes from `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`).
   */
  async rewrites() {
    const apiOrigin = getApiBaseUrl();
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiOrigin}/v1/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: getCSP(),
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin',
          },
        ],
      },
      // Scoped headers for checkout and wallet-heavy routes where extensions need relaxed COEP
      {
        source: '/(checkout|subscribe|wallet-demo)/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless',
          },
        ],
      },
      // Default COEP for other routes
      {
        source: '/((?!checkout|subscribe|wallet-demo).*)',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
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

export default withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})(nextConfig);
