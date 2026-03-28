/**
 * Soroban / Stellar environment validation at process startup.
 *
 * Fails fast with actionable messages when required variables are missing or
 * when optional variables are set to invalid values (so we never silently
 * accept bad configuration).
 */

/** Networks the backend is designed to run against (must match ops / deploy scripts). */
export const ALLOWED_STELLAR_NETWORKS = [
  'futurenet',
  'testnet',
  'mainnet',
] as const;

const CONTRACT_ID_PATTERN = /^C[A-Z2-7]{55}$/;

const PREFIX = '[soroban-env]';

function isNonEmpty(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== '';
}

/**
 * Validates Soroban-related variables from the given environment map.
 * Defaults to `process.env` when omitted (used from `bootstrap()`).
 *
 * @throws Error with a multi-line message listing every problem
 */
export function validateSorobanEnv(
  env: Record<string, string | undefined> = process.env,
): void {
  const errors: string[] = [];

  const network = env.STELLAR_NETWORK?.trim();
  if (!isNonEmpty(network)) {
    errors.push(
      'STELLAR_NETWORK is required. Set one of: futurenet, testnet, mainnet (e.g. STELLAR_NETWORK=testnet).',
    );
  } else {
    const n = network.toLowerCase();
    if (
      !ALLOWED_STELLAR_NETWORKS.includes(
        n as (typeof ALLOWED_STELLAR_NETWORKS)[number],
      )
    ) {
      errors.push(
        `STELLAR_NETWORK="${network}" is not supported. Use one of: ${ALLOWED_STELLAR_NETWORKS.join(', ')}.`,
      );
    }
  }

  const rpcUrl = env.SOROBAN_RPC_URL?.trim();
  if (!isNonEmpty(rpcUrl)) {
    errors.push(
      'SOROBAN_RPC_URL is required. Use your Soroban RPC endpoint (e.g. https://soroban-testnet.stellar.org for testnet).',
    );
  } else {
    try {
      const u = new URL(rpcUrl);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        errors.push(
          `SOROBAN_RPC_URL must use http or https; got protocol "${u.protocol}".`,
        );
      }
    } catch {
      errors.push(
        `SOROBAN_RPC_URL is not a valid URL: "${rpcUrl}". Example: https://soroban-testnet.stellar.org`,
      );
    }
  }

  const timeoutRaw = env.SOROBAN_RPC_TIMEOUT?.trim();
  if (isNonEmpty(timeoutRaw)) {
    const n = Number(timeoutRaw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
      errors.push(
        `SOROBAN_RPC_TIMEOUT must be a positive integer (milliseconds). Got "${timeoutRaw}". Example: 5000`,
      );
    } else if (n > 86_400_000) {
      errors.push(
        `SOROBAN_RPC_TIMEOUT is unreasonably large (${n} ms). Use a value ≤ 86400000 (24 hours) or leave unset for defaults.`,
      );
    }
  }

  const healthContract = env.SOROBAN_HEALTH_CHECK_CONTRACT?.trim();
  if (isNonEmpty(healthContract)) {
    if (!CONTRACT_ID_PATTERN.test(healthContract)) {
      errors.push(
        `SOROBAN_HEALTH_CHECK_CONTRACT must be a valid Soroban contract strkey (56 characters, starting with C). Got length ${healthContract.length}. Leave empty to skip contract health checks.`,
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `${PREFIX} Invalid Stellar / Soroban configuration:\n` +
        errors.map((e) => `  - ${e}`).join('\n') +
        `\n\nSee backend/.env.example (section "Stellar / Soroban").`,
    );
  }
}
