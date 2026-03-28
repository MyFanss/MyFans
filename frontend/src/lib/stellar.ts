import { getStellarRuntimeConfig } from '@/lib/contract-config';
import { createAppError } from '@/types/errors';

export function getStellarConfig() {
  return getStellarRuntimeConfig();
}

export async function buildSubscriptionTx(
  fanAddress: string,
  creatorAddress: string,
  planId: number,
  tokenAddress: string
) {
  try {
    const SDK = await import('@stellar/stellar-sdk');
    const config = getStellarConfig();
    const server = new SDK.Horizon.Server(config.horizonUrl);
    const account = await server.loadAccount(fanAddress);
    const networkPassphrase =
      config.network === 'testnet'
        ? SDK.Networks.TESTNET
        : config.network === 'futurenet'
          ? SDK.Networks.FUTURENET
          : SDK.Networks.PUBLIC;

    // These values will be consumed once the Soroban contract invocation is wired in.
    void creatorAddress;
    void planId;
    void tokenAddress;

    // Build transaction (simplified - actual Soroban invocation needs contract bindings)
    const tx = new SDK.TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase,
    })
      .setTimeout(300)
      .build();

    return tx.toXDR();
  } catch (err) {
    throw createAppError('TX_BUILD_FAILED', {
      message: err instanceof Error ? err.message : 'Failed to build transaction',
      cause: err instanceof Error ? err : undefined,
    });
  }
}

export async function submitTransaction(signedXdr: string) {
  try {
    const SDK = await import('@stellar/stellar-sdk');
    const config = getStellarConfig();
    const server = new SDK.Horizon.Server(config.horizonUrl);
    const networkPassphrase =
      config.network === 'testnet'
        ? SDK.Networks.TESTNET
        : config.network === 'futurenet'
          ? SDK.Networks.FUTURENET
          : SDK.Networks.PUBLIC;
    const tx = SDK.TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
    const result = await server.submitTransaction(tx);
    return result.hash;
  } catch (err) {
    throw createAppError('TX_SUBMIT_FAILED', {
      message: err instanceof Error ? err.message : 'Failed to submit transaction',
      cause: err instanceof Error ? err : undefined,
    });
  }
}

export async function checkSubscription(fanAddress: string, creatorAddress: string): Promise<boolean> {
  // Mock implementation - replace with actual Soroban RPC call
  void fanAddress;
  void creatorAddress;
  return false;
}
