import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";
import { getRemoteImagePatterns } from "./src/lib/image-remote-patterns";
import { getApiBaseUrl } from "./src/lib/api/base-url";

const isProd = process.env.NODE_ENV === 'production';

// Helper to generate CSP
function getCSP() {
  const apiHost = new URL(getApiBaseUrl()).host;

  const stellarHosts = [
    '*.stellar.org',
    'mainnet.sorobanrpc.com',
    'rpc-futurenet.stellar.org'
  ];

  const connectSrc = [
    "'self'",
    apiHost,
    ...stellarHosts,
    // Add localhost for dev
    !isProd && 'localhost:*',
    !isProd && '127.0.0.1:*',
  ].filter(Boolean).join(' ');

  const scriptSrc = isProd 
    ? "'self'" 
    : "'self' 'unsafe-inline' 'unsafe-eval'";

  const directives = {
    'default-src': ["'self'"],
    'script-src': [scriptSrc],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", "data:", "https:"],
    'font-src': ["'self'", "data:"],
    'connect-src': [connectSrc],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'upgrade-insecure-requests': isProd ? [] : null,
  };

  return Object.entries(directives)
    .filter(([_, value]) => value !== null)
    .map(([key, value]) => {
      if (Array.isArray(value) && value.length === 0) return key;
      return `${key} ${Array.isArray(value) ? value.join(' ') : value}`;
    })
    .join('; ');
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
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
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
