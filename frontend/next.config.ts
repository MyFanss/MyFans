import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

// Helper to generate CSP
function getCSP() {
  const apiHost = process.env.NEXT_PUBLIC_API_URL 
    ? new URL(process.env.NEXT_PUBLIC_API_URL).host 
    : 'localhost:3001';

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
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  experimental: {
    optimizeCss: true,
  },
  generateEtags: true,
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

export default nextConfig;
