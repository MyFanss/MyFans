/**
 * Remote image patterns for next/image.
 *
 * Expand this list as new trusted image hosts are added. Wildcards are
 * intentionally avoided to prevent open-redirect / image-proxy abuse.
 */
import type { RemotePattern } from 'next/dist/shared/lib/image-config';

export function getRemoteImagePatterns(): RemotePattern[] {
  return [
    {
      protocol: 'https',
      hostname: '**.ipfs.io',
    },
    {
      protocol: 'https',
      hostname: 'ipfs.io',
    },
    {
      protocol: 'https',
      hostname: 'cloudflare-ipfs.com',
    },
    {
      protocol: 'https',
      hostname: 'example.com',
    },
    // Stellar asset issuers may host logos here
    {
      protocol: 'https',
      hostname: '**.stellar.org',
    },
  ];
}
