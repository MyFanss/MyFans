import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { contractIdsFromDeployedEnv } from '../common/contract-deployed-env';

export interface ContractIds {
  myfans: string;
  myfansToken: string;
  creatorRegistry: string;
  subscriptions: string;
  contentAccess: string;
  earnings: string;
}

/** Shape written by contract/scripts/deploy.sh (deployed-local.json / deployed-testnet.json) */
interface DeployArtifact {
  schemaVersion?: string;
  contracts: {
    token?: string;
    creatorRegistry?: string;
    subscriptions?: string;
    contentAccess?: string;
    earnings?: string;
    /** legacy key used in some artifacts */
    myfans?: string;
    myfansToken?: string;
  };
}

/** Shape written by contract/contract-ids.json (flat) */
interface FlatArtifact {
  myfans?: string;
  myfansToken?: string;
  creatorRegistry?: string;
  subscriptions?: string;
  contentAccess?: string;
  earnings?: string;
}

function fromEnv(): ContractIds | null {
  return contractIdsFromDeployedEnv();
}

function parseDeployArtifact(raw: string): ContractIds {
  const parsed = JSON.parse(raw) as DeployArtifact | FlatArtifact;

  // Detect deploy-artifact format (has nested `contracts` key)
  if ('contracts' in parsed && parsed.contracts && typeof parsed.contracts === 'object') {
    const c = (parsed as DeployArtifact).contracts;
    return {
      myfans: c.myfans ?? '',
      myfansToken: c.token ?? c.myfansToken ?? '',
      creatorRegistry: c.creatorRegistry ?? '',
      subscriptions: c.subscriptions ?? '',
      contentAccess: c.contentAccess ?? '',
      earnings: c.earnings ?? '',
    };
  }

  // Flat format (contract-ids.json)
  const f = parsed as FlatArtifact;
  return {
    myfans: f.myfans ?? '',
    myfansToken: f.myfansToken ?? '',
    creatorRegistry: f.creatorRegistry ?? '',
    subscriptions: f.subscriptions ?? '',
    contentAccess: f.contentAccess ?? '',
    earnings: f.earnings ?? '',
  };
}

/**
 * Resolution order:
 *  1. Env vars — see contract/docs/DEPLOYED_ENV.md (canonical CONTRACT_ID_* + aliases)
 *  2. CONTRACT_IDS_PATH env var (explicit path — used by CI)
 *  3. contract/deployed-<STELLAR_NETWORK>.json  (e.g. deployed-testnet.json)
 *  4. contract/deployed-local.json
 *  5. contract/contract-ids.json  (flat fallback)
 */
export function loadContractIds(): ContractIds {
  const fromEnvResult = fromEnv();
  if (fromEnvResult) return fromEnvResult;

  const root = resolve(__dirname, '../../../contract');

  // If CONTRACT_IDS_PATH is explicitly set, it must exist — no fallthrough
  if (process.env.CONTRACT_IDS_PATH) {
    const explicit = process.env.CONTRACT_IDS_PATH;
    if (!existsSync(explicit)) {
      throw new Error(
        `Cannot load contract IDs. CONTRACT_IDS_PATH="${explicit}" does not exist.`,
      );
    }
    try {
      return parseDeployArtifact(readFileSync(explicit, 'utf-8'));
    } catch (err) {
      throw new Error(`Failed to parse contract artifact at ${explicit}: ${(err as Error).message}`);
    }
  }

  const candidates: string[] = [];

  const network = process.env.STELLAR_NETWORK;
  if (network) candidates.push(resolve(root, `deployed-${network}.json`));

  candidates.push(
    resolve(root, 'deployed-local.json'),
    resolve(root, 'contract-ids.json'),
  );

  for (const path of candidates) {
    if (existsSync(path)) {
      try {
        return parseDeployArtifact(readFileSync(path, 'utf-8'));
      } catch (err) {
        throw new Error(`Failed to parse contract artifact at ${path}: ${(err as Error).message}`);
      }
    }
  }

  throw new Error(
    'Cannot load contract IDs. Set CONTRACT_ID_MYFANS + CONTRACT_ID_MYFANS_TOKEN, or ' +
      'CONTRACT_ID_MYFANS_TOKEN + CONTRACT_ID_SUBSCRIPTION (and optional registry/access/earnings), ' +
      'CONTRACT_IDS_PATH, or provide a deploy artifact in contract/. See contract/docs/DEPLOYED_ENV.md.',
  );
}
