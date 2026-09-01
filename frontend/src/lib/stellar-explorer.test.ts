import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getStellarExpertBaseUrl,
  getStellarExpertTxUrl,
  isValidStellarTxHash,
} from './stellar-explorer';
import {
  buildRuntimeContractConfig,
  resetRuntimeContractConfigForTests,
  setRuntimeContractConfig,
} from './contract-config';

const HASH = 'a'.repeat(64);

describe('isValidStellarTxHash', () => {
  it('accepts a 64-char hex hash (any case)', () => {
    expect(isValidStellarTxHash(HASH)).toBe(true);
    expect(isValidStellarTxHash('AbCd'.repeat(16))).toBe(true);
    expect(isValidStellarTxHash(`  ${HASH}  `)).toBe(true);
  });

  it('rejects placeholder / non-hash values', () => {
    for (const value of ['', 'pending', 'hash', 'null', 'undefined', HASH.slice(1), `${HASH}zz`, null, undefined]) {
      expect(isValidStellarTxHash(value)).toBe(false);
    }
  });
});

describe('getStellarExpertBaseUrl', () => {
  it('maps each network to the correct stellar.expert segment', () => {
    expect(getStellarExpertBaseUrl('mainnet')).toBe('https://stellar.expert/explorer/public');
    expect(getStellarExpertBaseUrl('testnet')).toBe('https://stellar.expert/explorer/testnet');
    expect(getStellarExpertBaseUrl('futurenet')).toBe('https://stellar.expert/explorer/futurenet');
  });
});

describe('getStellarExpertTxUrl', () => {
  it('builds a tx URL on the explicitly passed network', () => {
    expect(getStellarExpertTxUrl(HASH, 'mainnet')).toBe(
      `https://stellar.expert/explorer/public/tx/${HASH}`,
    );
  });

  it('returns null for a missing or placeholder hash instead of a broken link', () => {
    expect(getStellarExpertTxUrl('', 'testnet')).toBeNull();
    expect(getStellarExpertTxUrl('pending', 'testnet')).toBeNull();
    expect(getStellarExpertTxUrl(undefined)).toBeNull();
  });

  describe('with a configured runtime network', () => {
    beforeEach(() => {
      resetRuntimeContractConfigForTests();
    });
    afterEach(() => {
      resetRuntimeContractConfigForTests();
    });

    it('uses the configured Stellar network when none is passed', () => {
      setRuntimeContractConfig(
        buildRuntimeContractConfig({ NEXT_PUBLIC_STELLAR_NETWORK: 'mainnet' }),
      );
      expect(getStellarExpertTxUrl(HASH)).toBe(
        `https://stellar.expert/explorer/public/tx/${HASH}`,
      );
    });

    it('defaults to testnet for a testnet config', () => {
      setRuntimeContractConfig(
        buildRuntimeContractConfig({ NEXT_PUBLIC_STELLAR_NETWORK: 'testnet' }),
      );
      expect(getStellarExpertTxUrl(HASH)).toBe(
        `https://stellar.expert/explorer/testnet/tx/${HASH}`,
      );
    });
  });
});
