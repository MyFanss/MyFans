import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildRuntimeContractConfig,
  getStellarRuntimeConfig,
  resetRuntimeContractConfigForTests,
  setRuntimeContractConfig,
  validateRuntimeContractConfig,
} from './contract-config';

const VALID_CONTRACT = 'CC3KRIRFHMF5U2HEQBDDOL5OZUZ3SOJJIJE7EHFP3C6SJLONGJE4WNFF';
const OTHER_VALID_CONTRACT = 'CDV2DF2BV3R7UM4LPETP77DAERE4DYX3FLC7HRVJV3KVHON7ZGLFLQ4U';

function makeSource(overrides: Record<string, string | undefined> = {}) {
  return {
    NEXT_PUBLIC_STELLAR_NETWORK: 'futurenet',
    NEXT_PUBLIC_MYFANS_TOKEN_CONTRACT_ID: VALID_CONTRACT,
    NEXT_PUBLIC_CREATOR_REGISTRY_CONTRACT_ID: OTHER_VALID_CONTRACT,
    NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ID: VALID_CONTRACT,
    NEXT_PUBLIC_CONTENT_ACCESS_CONTRACT_ID: OTHER_VALID_CONTRACT,
    NEXT_PUBLIC_EARNINGS_CONTRACT_ID: VALID_CONTRACT,
    ...overrides,
  };
}

describe('contract-config', () => {
  beforeEach(() => {
    resetRuntimeContractConfigForTests();
  });

  it('builds runtime config with environment-aware defaults', () => {
    const config = buildRuntimeContractConfig(
      makeSource({
        NEXT_PUBLIC_APP_ENV: '',
        VERCEL_ENV: 'preview',
      }),
    );

    expect(config.environment).toBe('preview');
    expect(config.network).toBe('futurenet');
    expect(config.sorobanRpcUrl).toBe('https://rpc-futurenet.stellar.org:443');
    expect(config.contractIds.subscription).toBe(VALID_CONTRACT);
  });

  it('falls back to the legacy plan token env key when needed', () => {
    const config = buildRuntimeContractConfig(
      makeSource({
        NEXT_PUBLIC_MYFANS_TOKEN_CONTRACT_ID: '',
        NEXT_PUBLIC_PLAN_TOKEN_CONTRACT_ID: OTHER_VALID_CONTRACT,
      }),
    );

    expect(config.contractIds.token).toBe(OTHER_VALID_CONTRACT);
  });

  it('marks required contract IDs as missing when they are absent', () => {
    const config = buildRuntimeContractConfig(
      makeSource({
        NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ID: '',
        NEXT_PUBLIC_EARNINGS_CONTRACT_ID: '',
      }),
    );

    expect(validateRuntimeContractConfig(config)).toEqual({
      ok: false,
      missingIds: ['subscription', 'earnings'],
      invalidIds: [],
    });
  });

  it('marks malformed contract IDs as invalid', () => {
    const config = buildRuntimeContractConfig(
      makeSource({
        NEXT_PUBLIC_MYFANS_TOKEN_CONTRACT_ID: 'not-a-contract',
      }),
    );

    expect(validateRuntimeContractConfig(config)).toEqual({
      ok: false,
      missingIds: [],
      invalidIds: ['token'],
    });
  });

  it('returns a stellar runtime view for consumers', () => {
    const config = buildRuntimeContractConfig(
      makeSource({
      NEXT_PUBLIC_HORIZON_URL: 'https://custom-horizon.example',
      NEXT_PUBLIC_SOROBAN_RPC_URL: 'https://custom-rpc.example',
      NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ID: OTHER_VALID_CONTRACT,
      }),
    );

    setRuntimeContractConfig(config);
    const stellarConfig = getStellarRuntimeConfig();

    expect(stellarConfig).toEqual({
      network: 'futurenet',
      horizonUrl: 'https://custom-horizon.example',
      sorobanRpcUrl: 'https://custom-rpc.example',
      subscriptionContractId: OTHER_VALID_CONTRACT,
    });
  });
});
