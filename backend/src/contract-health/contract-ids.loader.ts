import { readFileSync } from 'fs';
import { resolve } from 'path';

export interface ContractIds {
  myfans: string;
  myfansToken: string;
}

export function loadContractIds(): ContractIds {
  // Env vars take priority (set by CI after deploy)
  if (process.env.CONTRACT_ID_MYFANS && process.env.CONTRACT_ID_MYFANS_TOKEN) {
    return {
      myfans: process.env.CONTRACT_ID_MYFANS,
      myfansToken: process.env.CONTRACT_ID_MYFANS_TOKEN,
    };
  }

  // Fall back to artifact file written by contracts CI job
  const artifactPath =
    process.env.CONTRACT_IDS_PATH ??
    resolve(__dirname, '../../../contract/contract-ids.json');

  try {
    const raw = readFileSync(artifactPath, 'utf-8');
    const parsed = JSON.parse(raw) as ContractIds;
    return parsed;
  } catch {
    throw new Error(
      `Cannot load contract IDs. Set CONTRACT_ID_MYFANS / CONTRACT_ID_MYFANS_TOKEN env vars or provide CONTRACT_IDS_PATH pointing to contract-ids.json`,
    );
  }
}
