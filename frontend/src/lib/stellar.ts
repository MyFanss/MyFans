import { createAppError } from '@/types/errors';

// Stellar SDK types (install @stellar/stellar-sdk)
interface StellarSDK {
  Server: any;
  TransactionBuilder: any;
  Networks: any;
  Operation: any;
  Asset: any;
  Keypair: any;
}

let stellarSDK: StellarSDK | null = null;

// Lazy load Stellar SDK
async function getStellarSDK(): Promise<StellarSDK> {
  if (stellarSDK) return stellarSDK;
  stellarSDK = await import('@stellar/stellar-sdk');
  return stellarSDK;
}

export const STELLAR_CONFIG = {
  network: process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet',
  horizonUrl: process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org',
  sorobanRpcUrl: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
  subscriptionContractId: process.env.NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ID || '',
};

export async function getServer() {
  const SDK = await getStellarSDK();
  return new SDK.Server(STELLAR_CONFIG.horizonUrl);
}

export async function buildSubscriptionTx(
  fanAddress: string,
  creatorAddress: string,
  planId: number,
  tokenAddress: string
) {
  const SDK = await getStellarSDK();
  const server = await getServer();
  
  try {
    const account = await server.loadAccount(fanAddress);
    const networkPassphrase = STELLAR_CONFIG.network === 'testnet' 
      ? SDK.Networks.TESTNET 
      : SDK.Networks.PUBLIC;

    // Build Soroban contract invocation
    const tx = new SDK.TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase,
    })
      .addOperation(
        SDK.Operation.invokeContractFunction({
          contract: STELLAR_CONFIG.subscriptionContractId,
          function: 'subscribe',
          args: [
            SDK.nativeToScVal(fanAddress, { type: 'address' }),
            SDK.nativeToScVal(planId, { type: 'u32' }),
            SDK.nativeToScVal(tokenAddress, { type: 'address' }),
          ],
        })
      )
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
  const SDK = await getStellarSDK();
  const server = await getServer();
  
  try {
    const tx = SDK.TransactionBuilder.fromXDR(signedXdr, STELLAR_CONFIG.horizonUrl);
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
  try {
    const SDK = await getStellarSDK();
    const server = await getServer();
    
    // Call is_subscriber on contract
    const result = await server.getContractData(
      STELLAR_CONFIG.subscriptionContractId,
      SDK.xdr.ScVal.scvVec([
        SDK.nativeToScVal(fanAddress, { type: 'address' }),
        SDK.nativeToScVal(creatorAddress, { type: 'address' }),
      ])
    );
    
    return SDK.scValToBool(result);
  } catch {
    return false;
  }
}
