/**
 * Reads the first non-empty trimmed value for any of the given env keys.
 * Used so deploy output, backend .env, and CI can use one canonical name while
 * legacy aliases keep working.
 */
export function firstDefinedTrimmed(
  env: NodeJS.ProcessEnv,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const v = env[key]?.trim();
    if (v) return v;
  }
  return undefined;
}

/** Preferred: CONTRACT_ID_SUBSCRIPTION. Aliases: plural CONTRACT_ID_*, deploy.sh legacy names. */
export function resolveSubscriptionContractId(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return firstDefinedTrimmed(
    env,
    'CONTRACT_ID_SUBSCRIPTION',
    'CONTRACT_ID_SUBSCRIPTIONS',
    'SUBSCRIPTION_CONTRACT_ID',
    'SUBSCRIPTIONS_CONTRACT_ID',
  );
}

/**
 * Builds contract ID bundle from env using canonical CONTRACT_ID_* names and
 * transition aliases (TOKEN_CONTRACT_ID, *_CONTRACT_ID from deploy.sh, etc.).
 */
export function contractIdsFromDeployedEnv(
  env: NodeJS.ProcessEnv = process.env,
): {
  myfans: string;
  myfansToken: string;
  creatorRegistry: string;
  subscriptions: string;
  contentAccess: string;
  earnings: string;
} | null {
  const myfansToken = firstDefinedTrimmed(
    env,
    'CONTRACT_ID_MYFANS_TOKEN',
    'TOKEN_CONTRACT_ID',
  );
  const myfans = env.CONTRACT_ID_MYFANS?.trim() ?? '';

  const subscriptions = resolveSubscriptionContractId(env);
  const creatorRegistry = firstDefinedTrimmed(
    env,
    'CONTRACT_ID_CREATOR_REGISTRY',
    'CREATOR_REGISTRY_CONTRACT_ID',
  );
  const contentAccess = firstDefinedTrimmed(
    env,
    'CONTRACT_ID_CONTENT_ACCESS',
    'CONTENT_ACCESS_CONTRACT_ID',
  );
  const earnings = firstDefinedTrimmed(
    env,
    'CONTRACT_ID_EARNINGS',
    'EARNINGS_CONTRACT_ID',
  );

  const legacyPair = Boolean(myfans && myfansToken);
  const deployStyle = Boolean(myfansToken && subscriptions);

  if (!legacyPair && !deployStyle) {
    return null;
  }

  return {
    myfans,
    myfansToken: myfansToken as string,
    creatorRegistry: creatorRegistry ?? '',
    subscriptions: subscriptions ?? '',
    contentAccess: contentAccess ?? '',
    earnings: earnings ?? '',
  };
}
