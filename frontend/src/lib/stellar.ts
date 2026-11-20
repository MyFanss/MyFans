import {
  Contract,
  Networks,
  TransactionBuilder,
  Account,
  Operation,
  Asset,
  BASE_FEE,
  xdr,
} from '@stellar/stellar-sdk';

/**
 * Stellar transaction builders for the subscription money paths.
 *
 * These builders are PURE: they construct unsigned transactions only.
 * Signing is handled separately by the wallet layer (see wallet/walletconnect.ts).
 *
 * All builders produce real Soroban contract-invocation transactions — never
 * empty Horizon placeholder transactions — and match the canonical vectors in
 * `contract/test-vectors/TEST_VECTORS.md`.
 */

/** Default network passphrase (Stellar testnet). */
export const DEFAULT_NETWORK_PASSPHRASE = Networks.TESTNET;

/**
 * Resolve the network passphrase to use for a transaction.
 *
 * A network guard: if a passphrase is supplied it must be a known Stellar
 * network passphrase, otherwise we refuse to build (block build when the
 * network guard fails). This prevents signing a tx on the wrong network.
 */
export function resolveNetworkPassphrase(networkPassphrase?: string): string {
  const passphrase = networkPassphrase ?? DEFAULT_NETWORK_PASSPHRASE;
  const known = [Networks.PUBLIC, Networks.TESTNET, Networks.FUTURENET];
  if (!known.includes(passphrase)) {
    throw new Error(
      `Unknown network passphrase: ${passphrase}. Refusing to build transaction.`,
    );
  }
  return passphrase;
}

/** Arguments shared by every subscription builder. */
export interface SubscriptionTxParams {
  /** Source account (the subscriber) that will sign the transaction. */
  sourceAccount: string;
  /** Soroban contract id of the subscription contract. */
  contractId: string;
  /** Network passphrase; defaults to testnet. */
  networkPassphrase?: string;
  /** Base fee in stroops; defaults to BASE_FEE. */
  fee?: string;
  /** Transaction timeout in seconds; defaults to 30. */
  timeoutSeconds?: number;
}

/** Parameters for building a new subscription (`subscribe(fan, plan_id, asset)`). */
export interface BuildSubscriptionTxParams extends SubscriptionTxParams {
  /** Subscriber address (defaults to sourceAccount). */
  subscriber?: string;
  /** On-chain plan id (u64). */
  planId: number;
  /** Asset contract address; must match the plan's asset. */
  asset: string;
}

/** Parameters for extending a subscription (`extend_subscription(fan, plan_id)`). */
export interface BuildExtendSubscriptionTxParams extends SubscriptionTxParams {
  /** On-chain plan id (u64). */
  planId: number;
}

/** Parameters for cancelling a subscription (`cancel(fan, creator)`). */
export interface BuildCancelTxParams extends SubscriptionTxParams {
  /** Creator address whose subscription is cancelled. */
  creator: string;
}

function assertNonEmpty(value: string | undefined, name: string): string {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required argument: ${name}`);
  }
  return value;
}

function buildInvokeTx(
  params: SubscriptionTxParams,
  functionName: string,
  args: xdr.ScVal[],
): string {
  const contractId = assertNonEmpty(params.contractId, 'contractId');
  const sourceAccount = assertNonEmpty(params.sourceAccount, 'sourceAccount');
  const networkPassphrase = resolveNetworkPassphrase(params.networkPassphrase);

  const contract = new Contract(contractId);
  const account = new Account(sourceAccount, '0');

  const tx = new TransactionBuilder(account, {
    fee: params.fee ?? BASE_FEE,
    networkPassphrase,
  })
    .addOperation(contract.call(functionName, ...args))
    .setTimeout(params.timeoutSeconds ?? 30)
    .build();

  return tx.toXDR();
}

/**
 * Build a subscription-creation transaction invoking `subscribe` on the
 * subscription contract. Returns the unsigned transaction XDR.
 */
export function buildSubscriptionTx(params: BuildSubscriptionTxParams): string {
  const subscriber = params.subscriber ?? params.sourceAccount;
  const asset = assertNonEmpty(params.asset, 'asset');

  const args = [
    nativeToScVal(subscriber, { type: 'address' }),
    nativeToScVal(params.planId, { type: 'u64' }),
    nativeToScVal(asset, { type: 'address' }),
  ];

  return buildInvokeTx(params, 'subscribe', args);
}

/**
 * Build a subscription-renewal transaction invoking `extend_subscription` on
 * the subscription contract. The fan is the source account. Returns the
 * unsigned transaction XDR.
 */
export function buildExtendSubscriptionTx(
  params: BuildExtendSubscriptionTxParams,
): string {
  const args = [
    nativeToScVal(params.sourceAccount, { type: 'address' }),
    nativeToScVal(params.planId, { type: 'u64' }),
  ];

  return buildInvokeTx(params, 'extend_subscription', args);
}

/**
 * Build a subscription-cancellation transaction invoking `cancel` on the
 * subscription contract. The fan is the source account. Returns the unsigned
 * transaction XDR.
 */
export function buildCancelTx(params: BuildCancelTxParams): string {
  const creator = assertNonEmpty(params.creator, 'creator');

  const args = [
    nativeToScVal(params.sourceAccount, { type: 'address' }),
    nativeToScVal(creator, { type: 'address' }),
  ];

  return buildInvokeTx(params, 'cancel', args);
}

/**
 * Convenience re-export so callers can build ScVals without importing the SDK
 * directly. Kept local to avoid leaking SDK types across the app boundary.
 */
import { nativeToScVal } from '@stellar/stellar-sdk';

export { Asset };
