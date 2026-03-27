import { signTransaction } from '@/lib/wallet';
import { createAppError } from '@/types/errors';

export const STELLAR_CONFIG = {
  network: process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet',
  horizonUrl: process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org',
  sorobanRpcUrl: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
  subscriptionContractId: process.env.NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ID || '',
};

export interface CreateCreatorPlanInput {
  creatorAddress: string;
  tokenAddress: string;
  amountAtomic: string;
  intervalDays: number;
}

export interface CreateCreatorPlanResult {
  txHash: string;
  planId?: number;
  ledger?: number;
}

const MAX_TX_STATUS_POLLS = 8;
const TX_STATUS_POLL_DELAY_MS = 1500;

async function getStellarSdk() {
  return import('@stellar/stellar-sdk');
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getNetworkPassphrase() {
  const SDK = await getStellarSdk();

  switch (STELLAR_CONFIG.network) {
    case 'mainnet':
    case 'public':
      return SDK.Networks.PUBLIC;
    case 'futurenet':
      return SDK.Networks.FUTURENET;
    case 'testnet':
    default:
      return SDK.Networks.TESTNET;
  }
}

async function getRpcServer() {
  const SDK = await getStellarSdk();
  return new SDK.rpc.Server(STELLAR_CONFIG.sorobanRpcUrl);
}

function getCreatePlanConfigError() {
  return createAppError('TX_BUILD_FAILED', {
    message: 'Plan contract is not configured',
    description: 'Set NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ID before publishing plans on Soroban.',
  });
}

export async function buildCreatePlanTx({
  creatorAddress,
  tokenAddress,
  amountAtomic,
  intervalDays,
}: CreateCreatorPlanInput) {
  if (!STELLAR_CONFIG.subscriptionContractId) {
    throw getCreatePlanConfigError();
  }

  try {
    const SDK = await getStellarSdk();
    const server = await getRpcServer();
    const account = await server.getAccount(creatorAddress);
    const networkPassphrase = await getNetworkPassphrase();
    const contract = new SDK.Contract(STELLAR_CONFIG.subscriptionContractId);

    const tx = new SDK.TransactionBuilder(account, {
      fee: SDK.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        contract.call(
          'create_plan',
          SDK.Address.fromString(creatorAddress).toScVal(),
          SDK.Address.fromString(tokenAddress).toScVal(),
          SDK.nativeToScVal(amountAtomic, { type: 'i128' }),
          SDK.nativeToScVal(intervalDays, { type: 'u32' }),
        ),
      )
      .setTimeout(60)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    return preparedTx.toXDR();
  } catch (err) {
    throw createAppError('TX_BUILD_FAILED', {
      message: err instanceof Error ? err.message : 'Failed to build plan creation transaction',
      cause: err instanceof Error ? err : undefined,
    });
  }
}

async function waitForTransactionResult(hash: string) {
  const SDK = await getStellarSdk();
  const server = await getRpcServer();

  for (let attempt = 0; attempt < MAX_TX_STATUS_POLLS; attempt += 1) {
    const response = await server.getTransaction(hash);

    if (response.status === SDK.rpc.Api.GetTransactionStatus.SUCCESS) {
      return response;
    }

    if (response.status === SDK.rpc.Api.GetTransactionStatus.FAILED) {
      throw createAppError('TX_FAILED', {
        message: 'Plan transaction failed on Soroban',
        description: 'The transaction reached the network but was not accepted. Review the contract inputs and try again.',
      });
    }

    if (attempt < MAX_TX_STATUS_POLLS - 1) {
      await wait(TX_STATUS_POLL_DELAY_MS);
    }
  }

  throw createAppError('TX_TIMEOUT', {
    message: 'Waiting for Soroban confirmation took too long',
    description: 'Check your wallet or transaction hash to confirm whether the plan was created before retrying.',
  });
}

export async function submitCreatePlanTx(signedXdr: string): Promise<CreateCreatorPlanResult> {
  try {
    const SDK = await getStellarSdk();
    const server = await getRpcServer();
    const networkPassphrase = await getNetworkPassphrase();
    const signedTx = SDK.TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
    const submission = await server.sendTransaction(signedTx);

    if (submission.status === 'ERROR') {
      throw createAppError('TX_SUBMIT_FAILED', {
        message: 'Soroban rejected the transaction submission',
        description: submission.errorResult
          ? `RPC returned an error result: ${submission.errorResult.toXDR('base64')}`
          : 'The RPC node could not accept the transaction.',
      });
    }

    if (submission.status === 'TRY_AGAIN_LATER') {
      throw createAppError('NETWORK_ERROR', {
        message: 'Soroban RPC asked to retry later',
        description: 'The RPC node is busy right now. Wait a moment and submit the plan again.',
      });
    }

    const finalResult = await waitForTransactionResult(submission.hash);

    return {
      txHash: submission.hash,
      planId:
        finalResult.returnValue !== undefined
          ? Number(SDK.scValToNative(finalResult.returnValue))
          : undefined,
      ledger: finalResult.ledger,
    };
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      throw err;
    }

    throw createAppError('TX_SUBMIT_FAILED', {
      message: err instanceof Error ? err.message : 'Failed to submit transaction',
      cause: err instanceof Error ? err : undefined,
    });
  }
}

export async function createCreatorPlanOnSoroban(
  input: CreateCreatorPlanInput,
): Promise<CreateCreatorPlanResult> {
  const xdr = await buildCreatePlanTx(input);
  const signedXdr = await signTransaction(xdr, {
    network: STELLAR_CONFIG.network,
    networkPassphrase: await getNetworkPassphrase(),
  });

  return submitCreatePlanTx(signedXdr);
}

export async function buildSubscriptionTx(
  fanAddress: string,
  _creatorAddress: string,
  _planId: number,
  _tokenAddress: string
) {
  try {
    void _creatorAddress;
    void _planId;
    void _tokenAddress;

    const SDK = await import('@stellar/stellar-sdk');
    const server = new SDK.Horizon.Server(STELLAR_CONFIG.horizonUrl);
    const account = await server.loadAccount(fanAddress);
    const networkPassphrase = STELLAR_CONFIG.network === 'testnet' 
      ? SDK.Networks.TESTNET 
      : SDK.Networks.PUBLIC;

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
    const server = new SDK.Horizon.Server(STELLAR_CONFIG.horizonUrl);
    const tx = SDK.TransactionBuilder.fromXDR(signedXdr, await getNetworkPassphrase());
    const result = await server.submitTransaction(tx);
    return result.hash;
  } catch (err) {
    throw createAppError('TX_SUBMIT_FAILED', {
      message: err instanceof Error ? err.message : 'Failed to submit transaction',
      cause: err instanceof Error ? err : undefined,
    });
  }
}

export async function checkSubscription(_fanAddress: string, _creatorAddress: string): Promise<boolean> {
  void _fanAddress;
  void _creatorAddress;

  // Mock implementation - replace with actual Soroban RPC call
  return false;
}
