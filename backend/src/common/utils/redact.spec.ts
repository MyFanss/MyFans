import { redact, REDACTED, SENSITIVE_KEYS } from './redact';

describe('redact', () => {
  it('returns primitives unchanged', () => {
    expect(redact('hello')).toBe('hello');
    expect(redact(42)).toBe(42);
    expect(redact(true)).toBe(true);
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
  });

  it('redacts known sensitive keys (case-insensitive)', () => {
    const input: Record<string, string> = {
      password: 'secret123',
      token: 'tok_abc',
      access_token: 'at_xyz',
      refresh_token: 'rt_xyz',
      authorization: 'Bearer eyJ...',
      secret: 'my-secret',
      private_key: 'SXXXXX',
      seed: 'word1 word2',
      email: 'user@example.com',
      api_key: 'key-123',
    };

    const result = redact(input);

    for (const key of Object.keys(input)) {
      expect(result[key]).toBe(REDACTED);
    }
  });

  it('preserves non-sensitive fields', () => {
    const input = { username: 'alice', role: 'fan', planId: 7 };
    expect(redact(input)).toEqual(input);
  });

  it('redacts nested sensitive fields', () => {
    const input = {
      user: {
        email: 'user@example.com',
        profile: {
          token: 'nested-token',
          displayName: 'Alice',
        },
      },
    };

    const result = redact(input);
    expect(result.user.email).toBe(REDACTED);
    expect(result.user.profile.token).toBe(REDACTED);
    expect(result.user.profile.displayName).toBe('Alice');
  });

  it('redacts sensitive fields inside arrays', () => {
    const input = [
      { password: 'p1', name: 'a' },
      { password: 'p2', name: 'b' },
    ];

    const result = redact(input);
    expect(result[0].password).toBe(REDACTED);
    expect(result[0].name).toBe('a');
    expect(result[1].password).toBe(REDACTED);
    expect(result[1].name).toBe('b');
  });

  it('does not mutate the original object', () => {
    const input = { password: 'original', name: 'alice' };
    redact(input);
    expect(input.password).toBe('original');
  });

  it('redacts Authorization header regardless of casing', () => {
    const headers: Record<string, string> = {
      Authorization: 'Bearer token123',
    };
    const result = redact(headers);
    expect(result['Authorization']).toBe(REDACTED);
  });

  it('redacts wallet-related keys', () => {
    const input: Record<string, string> = {
      wallet_address: 'GABC123',
      stellar_secret: 'SXXX',
      privatekey: 'raw-key',
    };
    const result = redact(input);
    expect(result['wallet_address']).toBe(REDACTED);
    expect(result['stellar_secret']).toBe(REDACTED);
    expect(result['privatekey']).toBe(REDACTED);
  });

  it('SENSITIVE_KEYS set contains expected entries', () => {
    expect(SENSITIVE_KEYS.has('password')).toBe(true);
    expect(SENSITIVE_KEYS.has('authorization')).toBe(true);
    expect(SENSITIVE_KEYS.has('email')).toBe(true);
    expect(SENSITIVE_KEYS.has('private_key')).toBe(true);
    expect(SENSITIVE_KEYS.has('stellar_secret')).toBe(true);
  });
});
