export const startupConfig = {
  // fail-fast: crash on missing dependency; degraded: log warning and continue
  mode: (process.env.STARTUP_MODE || 'degraded') as 'fail-fast' | 'degraded',

  db: {
    enabled: process.env.STARTUP_PROBE_DB !== 'false',
    retries: parseInt(process.env.STARTUP_DB_RETRIES || '5'),
    retryDelayMs: parseInt(process.env.STARTUP_DB_RETRY_DELAY_MS || '2000'),
  },

  rpc: {
    enabled: process.env.STARTUP_PROBE_RPC !== 'false',
    url: process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
    retries: parseInt(process.env.STARTUP_RPC_RETRIES || '3'),
    retryDelayMs: parseInt(process.env.STARTUP_RPC_RETRY_DELAY_MS || '2000'),
  },
};
