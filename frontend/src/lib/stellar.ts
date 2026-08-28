import { signTransaction } from '@/lib/wallet';
import { createAppError } from '@/types/errors';
import { getStellarRuntimeConfig } from '@/lib/contract-config';
import { assertWalletNetworkMatches } from '@/lib/network-guard';

export function getStellarConfig() {
  return getStellarRuntimeConfig();
}

const STELLAR_CONFIG = getStellarRuntimeConfig();

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
  await assertWalletNetworkMatches();
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
  await assertWalletNetworkMatches();
  const xdr = await buildCreatePlanTx(input);
  const signedXdr = await signTransaction(xdr, {
    network: STELLAR_CONFIG.network,
    networkPassphrase: await getNetworkPassphrase(),
  });

  return submitCreatePlanTx(signedXdr);
}

export async function buildSubscriptionTx(
  fanAddress: string,
  creatorAddress: string,
  planId: number,
  tokenAddress: string
) {
  const config = getStellarConfig();
  if (!config.subscriptionContractId) {
    throw createAppError('TX_BUILD_FAILED', {
      message: 'Subscription contract is not configured',
      description: 'Set NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ID before subscribing on Soroban.',
    });
  }

  try {
    const SDK = await getStellarSdk();
    const server = await getRpcServer();
    const account = await server.getAccount(fanAddress);
    const networkPassphrase = await getNetworkPassphrase();
    const contract = new SDK.Contract(config.subscriptionContractId);

    const tx = new SDK.TransactionBuilder(account, {
      fee: SDK.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        contract.call(
          'subscribe',
          SDK.Address.fromString(fanAddress).toScVal(),
          SDK.Address.fromString(creatorAddress).toScVal(),
          SDK.nativeToScVal(planId, { type: 'u32' }),
          SDK.Address.fromString(tokenAddress).toScVal(),
        ),
      )
      .setTimeout(60)
      .build();

    // Let simulation errors from prepareTransaction (paused market, token
    // mismatch, insufficient balance, etc.) surface to the caller instead
    // of being swallowed.
    const preparedTx = await server.prepareTransaction(tx);
    return preparedTx.toXDR();
  } catch (err) {
    throw createAppError('TX_BUILD_FAILED', {
      message: err instanceof Error ? err.message : 'Failed to build subscription transaction',
      cause: err instanceof Error ? err : undefined,
    });
  }
}

export async function submitTransaction(signedXdr: string) {
  await assertWalletNetworkMatches();
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

export interface CancelSubscriptionInput {
  fanAddress: string;
  creatorAddress: string;
  /** 0 = user-initiated, 1 = too expensive, 2 = content quality, 3 = switching creator, 4 = other */
  reason?: number;
}

export async function buildCancelSubscriptionTx({
  fanAddress,
  creatorAddress,
  reason = 0,
}: CancelSubscriptionInput): Promise<string> {
  const config = getStellarConfig();
  if (!config.subscriptionContractId) {
    throw createAppError('TX_BUILD_FAILED', {
      message: 'Subscription contract is not configured',
      description: 'Set NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ID before cancelling on Soroban.',
    });
  }

  try {
    const SDK = await getStellarSdk();
    const server = await getRpcServer();
    const account = await server.getAccount(fanAddress);
    const networkPassphrase = await getNetworkPassphrase();
    const contract = new SDK.Contract(config.subscriptionContractId);

    const tx = new SDK.TransactionBuilder(account, {
      fee: SDK.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        contract.call(
          'cancel',
          SDK.Address.fromString(fanAddress).toScVal(),
          SDK.Address.fromString(creatorAddress).toScVal(),
          SDK.nativeToScVal(reason, { type: 'u32' }),
        ),
      )
      .setTimeout(60)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    return preparedTx.toXDR();
  } catch (err) {
    throw createAppError('TX_BUILD_FAILED', {
      message: err instanceof Error ? err.message : 'Failed to build cancel transaction',
      cause: err instanceof Error ? err : undefined,
    });
  }
}

export async function cancelSubscriptionOnSoroban(
  input: CancelSubscriptionInput,
): Promise<{ txHash: string }> {
  await assertWalletNetworkMatches();
  const xdr = await buildCancelSubscriptionTx(input);
  const networkPassphrase = await getNetworkPassphrase();
  const signedXdr = await signTransaction(xdr, {
    network: getStellarConfig().network,
    networkPassphrase,
  });
  const txHash = await submitTransaction(signedXdr);
  return { txHash };
}

export interface ExtendSubscriptionInput {
  fanAddress: string;
  creatorAddress: string;
  /** Token contract address the plan is denominated in (from plan metadata). */
  tokenAddress: string;
  /** Number of extra ledgers to extend the subscription's TTL by on-chain. */
  extraLedgers?: number;
}

function isPausedContractError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /paused/i.test(message);
}

/**
 * Builds an unsigned `extend_subscription` invocation for renewing an
 * existing fan→creator subscription on the subscription contract. Mirrors
 * `buildCancelSubscriptionTx` — same account/network/contract plumbing, but
 * a different call and args (token + extra_ledgers, per the contract's
 * `extend_subscription` entrypoint).
 */
export async function buildExtendSubscriptionTx({
  fanAddress,
  creatorAddress,
  tokenAddress,
  extraLedgers = 30 * 24 * 60 * 12, // ~30 days of 5s ledgers, default renewal window
}: ExtendSubscriptionInput): Promise<string> {
  const config = getStellarConfig();
  if (!config.subscriptionContractId) {
    throw createAppError('TX_BUILD_FAILED', {
      message: 'Subscription contract is not configured',
      description: 'Set NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ID before renewing on Soroban.',
    });
  }

  try {
    const SDK = await getStellarSdk();
    const server = await getRpcServer();
    const account = await server.getAccount(fanAddress);
    const networkPassphrase = await getNetworkPassphrase();
    const contract = new SDK.Contract(config.subscriptionContractId);

    const tx = new SDK.TransactionBuilder(account, {
      fee: SDK.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        contract.call(
          'extend_subscription',
          SDK.Address.fromString(fanAddress).toScVal(),
          SDK.Address.fromString(creatorAddress).toScVal(),
          SDK.Address.fromString(tokenAddress).toScVal(),
          SDK.nativeToScVal(extraLedgers, { type: 'u32' }),
        ),
      )
      .setTimeout(60)
      .build();

    const preparedTx = await server.prepareTransaction(tx);
    return preparedTx.toXDR();
  } catch (err) {
    if (isPausedContractError(err)) {
      throw createAppError('TX_BUILD_FAILED', {
        message: 'This creator’s subscription plan is currently paused',
        description: 'The creator has paused new renewals. Please try again later or contact the creator.',
        cause: err instanceof Error ? err : undefined,
      });
    }
    throw createAppError('TX_BUILD_FAILED', {
      message: err instanceof Error ? err.message : 'Failed to build renewal transaction',
      cause: err instanceof Error ? err : undefined,
    });
  }
}

export async function extendSubscriptionOnSoroban(
  input: ExtendSubscriptionInput,
): Promise<{ txHash: string }> {
  await assertWalletNetworkMatches();
  const xdr = await buildExtendSubscriptionTx(input);
  const networkPassphrase = await getNetworkPassphrase();
  const signedXdr = await signTransaction(xdr, {
    network: getStellarConfig().network,
    networkPassphrase,
  });
  const txHash = await submitTransaction(signedXdr);
  return { txHash };
}

/** Dummy source account used for read-only simulations (mirrors the backend's
 *  SubscriptionChainReaderService pattern so we don't require the fan's
 *  account to exist/be funded just to check subscription status). */
const SIM_SOURCE_ACCOUNT = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

export async function checkSubscription(fanAddress: string, creatorAddress: string): Promise<boolean> {
  const config = getStellarConfig();
  if (!config.subscriptionContractId) return false;

  try {
    const SDK = await getStellarSdk();
    const server = await getRpcServer();
    const networkPassphrase = await getNetworkPassphrase();
    const contract = new SDK.Contract(config.subscriptionContractId);
    const source = new SDK.Account(SIM_SOURCE_ACCOUNT, '0');

    const tx = new SDK.TransactionBuilder(source, {
      fee: SDK.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        contract.call(
          'is_subscriber',
          SDK.Address.fromString(fanAddress).toScVal(),
          SDK.Address.fromString(creatorAddress).toScVal(),
        ),
      )
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (!SDK.rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) {
      return false;
    }

    return Boolean(SDK.scValToNative(sim.result.retval));
  } catch {
    return false;
  }
}

export async function checkTransactionStatus(
  txHash: string
): Promise<'pending' | 'confirmed' | 'failed'> {
  try {
    const response = await fetch(
      `${STELLAR_CONFIG.horizonUrl}/transactions/${txHash}`
    );
    if (response.status === 404) {
      return 'pending';
    }
    if (!response.ok) {
      return 'pending';
    }
    const data = await response.json();
    // Horizon returns successful field; absence or false means failed
    if (data.successful === true) {
      return 'confirmed';
    }
    if (data.successful === false) {
      return 'failed';
    }
    return 'pending';
  } catch {
    return 'pending';
  }
}
