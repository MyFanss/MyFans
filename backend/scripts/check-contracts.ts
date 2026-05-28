#!/usr/bin/env ts-node
/**
 * Contract health check script — run by CI after contract deployment.
 * Loads contract IDs from artifact or env vars, invokes read methods,
 * and exits non-zero if any contract is unavailable or mismatched.
 */
import { ContractHealthService } from '../src/contract-health/contract-health.service';
import { loadContractIds } from '../src/contract-health/contract-ids.loader';

async function main() {
  const service = new ContractHealthService();
  const ids = loadContractIds();

  console.log('Running contract health checks...');
  console.log(`RPC: ${process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org'}`);
  console.log(`Contracts: ${JSON.stringify(ids)}\n`);

  const checks = await Promise.all([
    service.checkContract('myfans', ids.myfans, 'is_subscriber', []),
    service.checkContract('myfans-token', ids.myfansToken, 'version', []),
  ]);

  let failed = false;

  for (const result of checks) {
    const status = result.ok ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}  ${result.contract} (${result.contractId}) — ${result.durationMs}ms`);
    if (!result.ok) {
      console.error(`       Error: ${result.error}`);
      failed = true;
    }
  }

  if (failed) {
    console.error('\nContract health checks failed.');
    process.exit(1);
  }

  console.log('\nAll contract health checks passed.');
}

main().catch((err) => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
