import { StrKey } from '@stellar/stellar-sdk';

export type StellarNetwork = 'testnet' | 'futurenet' | 'mainnet';
export type ContractIdKey =
  | 'token'
  | 'creatorRegistry'
  | 'subscription'
  | 'contentAccess'
  | 'earnings';

export interface ContractIds {
  token: string;
  creatorRegistry: string;
  subscription: string;
  contentAccess: string;
  earnings: string;
}

export interface RuntimeContractConfig {
  environment: string;
  network: StellarNetwork;
  horizonUrl: string;
  sorobanRpcUrl: string;
  contractIds: ContractIds;
}

export interface ContractConfigValidationResult {
  ok: boolean;
  missingIds: ContractIdKey[];
  invalidIds: ContractIdKey[];
}

type ConfigSource = Record<string, string | undefined>;

const CONTRACT_ID_LABELS: Record<ContractIdKey, string> = {
  token: 'MyFans token',
  creatorRegistry: 'Creator registry',
  subscription: 'Subscription',
  contentAccess: 'Content access',
  earnings: 'Earnings',
};

const CONTRACT_ID_ENV_KEYS: Record<ContractIdKey, string[]> = {
  token: ['NEXT_PUBLIC_MYFANS_TOKEN_CONTRACT_ID', 'NEXT_PUBLIC_PLAN_TOKEN_CONTRACT_ID'],
  creatorRegistry: ['NEXT_PUBLIC_CREATOR_REGISTRY_CONTRACT_ID'],
  subscription: ['NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ID'],
  contentAccess: ['NEXT_PUBLIC_CONTENT_ACCESS_CONTRACT_ID'],
  earnings: ['NEXT_PUBLIC_EARNINGS_CONTRACT_ID'],
};

const NETWORK_DEFAULTS: Record<StellarNetwork, { horizonUrl: string; sorobanRpcUrl: string }> = {
  testnet: {
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
  },
  futurenet: {
    horizonUrl: 'https://horizon-futurenet.stellar.org',
    sorobanRpcUrl: 'https://rpc-futurenet.stellar.org:443',
  },
  mainnet: {
    horizonUrl: 'https://horizon.stellar.org',
    sorobanRpcUrl: 'https://mainnet.sorobanrpc.com',
  },
};

const REQUIRED_CONTRACT_IDS: ContractIdKey[] = [
  'token',
  'creatorRegistry',
  'subscription',
  'contentAccess',
  'earnings',
];

declare global {
  interface Window {
    __MYFANS_RUNTIME_CONTRACT_CONFIG__?: RuntimeContractConfig;
  }
}

let cachedRuntimeConfig: RuntimeContractConfig | null = null;

function getFirstDefinedValue(source: ConfigSource, keys: string[]) {
  for (const key of keys) {
    const value = source[key]?.trim();
    if (value) {
      return value;
    }
  }

  return '';
}

function normalizeNetwork(value?: string): StellarNetwork {
  switch (value?.trim().toLowerCase()) {
    case 'futurenet':
      return 'futurenet';
    case 'mainnet':
    case 'public':
      return 'mainnet';
    case 'testnet':
    default:
      return 'testnet';
  }
}

export function buildRuntimeContractConfig(
  source: ConfigSource = process.env,
): RuntimeContractConfig {
  const network = normalizeNetwork(source.NEXT_PUBLIC_STELLAR_NETWORK);
  const defaults = NETWORK_DEFAULTS[network];

  return {
    environment:
      source.NEXT_PUBLIC_APP_ENV?.trim() ||
      source.VERCEL_ENV?.trim() ||
      source.NODE_ENV?.trim() ||
      'development',
    network,
    horizonUrl: source.NEXT_PUBLIC_HORIZON_URL?.trim() || defaults.horizonUrl,
    sorobanRpcUrl: source.NEXT_PUBLIC_SOROBAN_RPC_URL?.trim() || defaults.sorobanRpcUrl,
    contractIds: {
      token: getFirstDefinedValue(source, CONTRACT_ID_ENV_KEYS.token),
      creatorRegistry: getFirstDefinedValue(source, CONTRACT_ID_ENV_KEYS.creatorRegistry),
      subscription: getFirstDefinedValue(source, CONTRACT_ID_ENV_KEYS.subscription),
      contentAccess: getFirstDefinedValue(source, CONTRACT_ID_ENV_KEYS.contentAccess),
      earnings: getFirstDefinedValue(source, CONTRACT_ID_ENV_KEYS.earnings),
    },
  };
}

export function setRuntimeContractConfig(config: RuntimeContractConfig) {
  cachedRuntimeConfig = config;

  if (typeof window !== 'undefined') {
    window.__MYFANS_RUNTIME_CONTRACT_CONFIG__ = config;
  }
}

export function getRuntimeContractConfig(): RuntimeContractConfig {
  if (typeof window !== 'undefined' && window.__MYFANS_RUNTIME_CONTRACT_CONFIG__) {
    cachedRuntimeConfig = window.__MYFANS_RUNTIME_CONTRACT_CONFIG__;
    return window.__MYFANS_RUNTIME_CONTRACT_CONFIG__;
  }

  if (cachedRuntimeConfig) {
    return cachedRuntimeConfig;
  }

  const config = buildRuntimeContractConfig();
  cachedRuntimeConfig = config;
  return config;
}

export function validateRuntimeContractConfig(
  config: RuntimeContractConfig,
): ContractConfigValidationResult {
  const missingIds: ContractIdKey[] = [];
  const invalidIds: ContractIdKey[] = [];

  for (const key of REQUIRED_CONTRACT_IDS) {
    const value = config.contractIds[key].trim();

    if (!value) {
      missingIds.push(key);
      continue;
    }

    if (!StrKey.isValidContract(value)) {
      invalidIds.push(key);
    }
  }

  return {
    ok: missingIds.length === 0 && invalidIds.length === 0,
    missingIds,
    invalidIds,
  };
}

export function getContractIdLabel(key: ContractIdKey) {
  return CONTRACT_ID_LABELS[key];
}

export function getRuntimeContractConfigScript(config: RuntimeContractConfig) {
  const serialized = JSON.stringify(config).replace(/</g, '\\u003c');
  return `window.__MYFANS_RUNTIME_CONTRACT_CONFIG__ = ${serialized};`;
}

export function getStellarRuntimeConfig() {
  const config = getRuntimeContractConfig();

  return {
    network: config.network,
    horizonUrl: config.horizonUrl,
    sorobanRpcUrl: config.sorobanRpcUrl,
    subscriptionContractId: config.contractIds.subscription,
  };
}

export function resetRuntimeContractConfigForTests() {
  cachedRuntimeConfig = null;

  if (typeof window !== 'undefined') {
    delete window.__MYFANS_RUNTIME_CONTRACT_CONFIG__;
  }
}
