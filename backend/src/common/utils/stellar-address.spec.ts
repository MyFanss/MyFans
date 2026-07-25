import { isStellarAccountAddress, sanitizeStellarAddress } from './stellar-address';

const VALID = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';

describe('isStellarAccountAddress', () => {
  it('accepts a valid G-strkey', () => {
    expect(isStellarAccountAddress(VALID)).toBe(true);
  });

  it('rejects address not starting with G', () => {
    expect(isStellarAccountAddress('SAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN')).toBe(false);
  });

  it('rejects address shorter than 56 chars', () => {
    expect(isStellarAccountAddress('GAAZI4TCR3')).toBe(false);
  });

  it('rejects address longer than 56 chars', () => {
    expect(isStellarAccountAddress(VALID + 'A')).toBe(false);
  });

  it('rejects SQL injection payload', () => {
    expect(isStellarAccountAddress("' OR '1'='1")).toBe(false);
  });

  it('rejects NoSQL injection payload', () => {
    expect(isStellarAccountAddress('{"$gt":""}')).toBe(false);
  });

  it('rejects null byte injection', () => {
    expect(isStellarAccountAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN\0')).toBe(false);
  });

  it('rejects chars outside base-32 alphabet (lowercase)', () => {
    expect(isStellarAccountAddress(VALID.toLowerCase())).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isStellarAccountAddress(null)).toBe(false);
    expect(isStellarAccountAddress(undefined)).toBe(false);
    expect(isStellarAccountAddress(123456)).toBe(false);
  });
});

describe('sanitizeStellarAddress', () => {
  it('returns the address unchanged when already valid', () => {
    expect(sanitizeStellarAddress(VALID)).toBe(VALID);
  });

  it('returns null for SQL injection payload', () => {
    expect(sanitizeStellarAddress("' OR '1'='1")).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(sanitizeStellarAddress(null)).toBeNull();
    expect(sanitizeStellarAddress(42)).toBeNull();
  });

  it('returns null when stripped result is not a valid address', () => {
    expect(sanitizeStellarAddress('not-an-address')).toBeNull();
  });
});

import { AuthService } from '../auth/auth.service';
import { BadRequestException } from '@nestjs/common';

describe('AuthService.createSession', () => {
  let service: AuthService;

  beforeEach(() => { service = new AuthService(null as any); });

  it('returns session for valid address', async () => {
    const result = await service.createSession(VALID);
    expect(result.userId).toBe(VALID);
    expect(result.token).toBeTruthy();
  });

  it('throws BadRequestException for SQL injection', async () => {
    await expect(service.createSession("' OR '1'='1")).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException for oversized input', async () => {
    await expect(service.createSession('G' + 'A'.repeat(200))).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException for empty string', async () => {
    await expect(service.createSession('')).rejects.toThrow(BadRequestException);
  });
});
