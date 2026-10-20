import { describe, expect, it } from 'vitest';
import { getRemoteImagePatterns } from './image-remote-patterns';

describe('image-remote-patterns.ts', () => {
  it('returns only https patterns', () => {
    const patterns = getRemoteImagePatterns();
    expect(patterns.length).toBeGreaterThan(0);
    for (const pattern of patterns) {
      expect(pattern.protocol).toBe('https');
    }
  });

  it('includes the expected trusted hosts', () => {
    const hostnames = getRemoteImagePatterns().map((p) => p.hostname);
    expect(hostnames).toEqual(
      expect.arrayContaining(['ipfs.io', 'cloudflare-ipfs.com', 'example.com', '**.stellar.org']),
    );
  });

  it('scopes the ipfs.io wildcard to a single subdomain level, not an unbounded wildcard', () => {
    const ipfsPattern = getRemoteImagePatterns().find((p) => p.hostname.endsWith('ipfs.io') && p.hostname !== 'ipfs.io');
    expect(ipfsPattern).toBeDefined();
    expect(ipfsPattern?.hostname).toBe('*.ipfs.io');
    // '**' matches any number of subdomain levels (e.g. a.b.c.ipfs.io);
    // '*' matches exactly one level, so the pattern must not use '**'.
    expect(ipfsPattern?.hostname.startsWith('**')).toBe(false);
  });
});
