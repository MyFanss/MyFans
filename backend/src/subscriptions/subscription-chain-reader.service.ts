import { Injectable, Logger } from '@nestjs/common';
import {
  Account,
  Address,
  Contract,
  Networks,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { CircuitOpenError, withRetry } from '../common/utils/rpc-retry';
import { resolveSubscriptionContractId } from '../common/contract-deployed-env';
import { LedgerClockService } from './ledger-clock.service';

export type ChainReadResult =
  | { ok: true; isSubscriber: boolean }
  | { ok: false; error: string };

export type ChainExpiryReadResult =
  | { ok: true; expiryUnix: number; expiryLedgerSeq: number; skewMs: number }
  | { ok: false; error: string };

export type ChainPlanReadResult =
  | { ok: true; plan: { creator: string; asset: string; amount: string; intervalDays: number } }
  | { ok: false; error: string };

export type ChainPlanCountReadResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

/** Dummy source account used for read-only simulations. */
const SIM_SOURCE = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

const PERMANENT_ERROR = (e: unknown) =>
  e instanceof CircuitOpenError ||
  (e instanceof Error && /invalid contract|not found/i.test(e.message));

/**
 * Narrows a SimulateTransactionResponse to the retval, or returns an error
 * string using the current @stellar/stellar-sdk discriminated unions:
 *
 *   SimulateTransactionResponse
 *     ├─ SimulateTransactionErrorResponse   → .error: string
 *     ├─ SimulateTransactionSuccessResponse → .result?: SimulateHostFunctionResult
 *     └─ SimulateTransactionRestoreResponse → .result: SimulateHostFunctionResult (required)
 *                                             .restorePreamble (ledger entry needs restore)
 *
 * A restore response means the entry exists but is expired/archived; we treat
 * it as a transient error so the caller can retry after restoration.
 */
function extractRetval(
  sim: rpc.Api.SimulateTransactionResponse,
): { retval: import('@stellar/stellar-sdk').xdr.ScVal } | { error: string } {
  if (rpc.Api.isSimulationError(sim)) {
    return { error: sim.error };
  }

  if (rpc.Api.isSimulationRestore(sim)) {
    // Entry is archived — caller should restore before retrying.
    return { error: 'Ledger entry requires restoration before simulation can succeed.' };
  }

  // isSimulationSuccess: result is optional (only present for invocation sims)
  if (!rpc.Api.isSimulationSuccess(sim)) {
    return { error: 'Unknown simulation response shape.' };
  }

  if (!sim.result?.retval) {
    return { error: 'Simulation succeeded but returned no retval (unexpected).' };
  }

  return { retval: sim.result.retval };
}

/**
 * Read-only Soroban simulation of the subscription contract methods.
 * Skipped when no contract id is configured.
 */
@Injectable()
export class SubscriptionChainReaderService {
  private readonly logger = new Logger(SubscriptionChainReaderService.name);

  constructor(private readonly ledgerClock: LedgerClockService) {}

  getConfiguredContractId(): string | undefined {
    return (
      resolveSubscriptionContractId() ?? process.env.CONTRACT_ID_MYFANS?.trim()
    );
  }

  private getRpcUrl(): string {
    return (
      process.env.SOROBAN_RPC_URL?.trim() ||
      'https://soroban-testnet.stellar.org'
    );
  }

  private getNetworkPassphrase(): string {
    const fromEnv = process.env.STELLAR_NETWORK_PASSPHRASE?.trim();
    if (fromEnv) return fromEnv;
    const n = (process.env.STELLAR_NETWORK ?? 'testnet').toLowerCase();
    const map: Record<string, string> = {
      testnet: Networks.TESTNET,
      futurenet: Networks.FUTURENET,
      mainnet: Networks.PUBLIC,
    };
    return map[n] ?? Networks.TESTNET;
  }

  private makeServer(): rpc.Server {
    const rpcUrl = this.getRpcUrl();
    return new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http://') });
  }

  private buildTx(op: ReturnType<Contract['call']>): ReturnType<TransactionBuilder['build']> {
    const source = new Account(SIM_SOURCE, '1');
    return new TransactionBuilder(source, {
      fee: '100000',
      networkPassphrase: this.getNetworkPassphrase(),
    })
      .addOperation(op)
      .setTimeout(30)
      .build();
  }

  /**
   * Simulates `is_subscriber(fan, creator)` on the deployed subscription contract.
   */
  async readIsSubscriber(
    contractId: string,
    fan: string,
    creator: string,
  ): Promise<ChainReadResult> {
    try {
      const contract = new Contract(contractId);
      const op = contract.call(
        'is_subscriber',
        Address.fromString(fan).toScVal(),
        Address.fromString(creator).toScVal(),
      );

      const sim = await withRetry(
        'soroban-rpc',
        () => this.makeServer().simulateTransaction(this.buildTx(op)),
        { isPermanentError: PERMANENT_ERROR },
      );

      const extracted = extractRetval(sim);
      if ('error' in extracted) {
        return { ok: false, error: extracted.error };
      }

      return { ok: true, isSubscriber: Boolean(scValToNative(extracted.retval)) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Chain read is_subscriber failed: ${message}`);
      return { ok: false, error: message };
    }
  }

  /**
   * Reads the subscription expiry from the contract, skew-corrected via
   * LedgerClockService.
   */
  async readExpiryUnix(
    contractId: string,
    fan: string,
    creator: string,
  ): Promise<ChainExpiryReadResult> {
    try {
      const contract = new Contract(contractId);
      const op = contract.call(
        'get_expiry_unix',
        Address.fromString(fan).toScVal(),
        Address.fromString(creator).toScVal(),
      );

      const sim = await withRetry(
        'soroban-rpc',
        () => this.makeServer().simulateTransaction(this.buildTx(op)),
        { isPermanentError: PERMANENT_ERROR },
      );

      const extracted = extractRetval(sim);
      if ('error' in extracted) {
        return { ok: false, error: extracted.error };
      }

      // Contract returns (expiry_ledger_seq: u64, expiry_unix: u64)
      const native = scValToNative(extracted.retval) as [bigint, bigint];
      const expiryLedgerSeq = Number(native[0]);
      const contractExpiryUnix = Number(native[1]);

      const snapshot = await this.ledgerClock.fetchSnapshot();
      const derivedExpiryUnix = this.ledgerClock.ledgerSeqToUnix(expiryLedgerSeq, snapshot);
      const expiryUnix = contractExpiryUnix > 0 ? contractExpiryUnix : derivedExpiryUnix;

      return { ok: true, expiryUnix, expiryLedgerSeq, skewMs: snapshot.skewMs };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Chain read get_expiry_unix failed: ${message}`);
      return { ok: false, error: message };
    }
  }

  /**
   * Simulates `get_plan(plan_id)` on the deployed contract.
   */
  async readPlan(
    contractId: string,
    planId: number,
  ): Promise<ChainPlanReadResult> {
    try {
      const contract = new Contract(contractId);
      const op = contract.call('get_plan', nativeToScVal(planId));

      const sim = await withRetry(
        'soroban-rpc',
        () => this.makeServer().simulateTransaction(this.buildTx(op)),
        { isPermanentError: PERMANENT_ERROR },
      );

      const extracted = extractRetval(sim);
      if ('error' in extracted) {
        return { ok: false, error: extracted.error };
      }

      const native = scValToNative(extracted.retval);
      if (native === null) {
        return { ok: false, error: 'Plan not found' };
      }

      const plan = native as { creator: string; asset: string; amount: bigint; interval_days: number };
      return {
        ok: true,
        plan: {
          creator: plan.creator,
          asset: plan.asset,
          amount: plan.amount.toString(),
          intervalDays: plan.interval_days,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Chain read get_plan failed: ${message}`);
      return { ok: false, error: message };
    }
  }

  /**
   * Simulates `get_plan_count()` on the deployed contract.
   */
  async readPlanCount(contractId: string): Promise<ChainPlanCountReadResult> {
    try {
      const contract = new Contract(contractId);
      const op = contract.call('get_plan_count');

      const sim = await withRetry(
        'soroban-rpc',
        () => this.makeServer().simulateTransaction(this.buildTx(op)),
        { isPermanentError: PERMANENT_ERROR },
      );

      const extracted = extractRetval(sim);
      if ('error' in extracted) {
        return { ok: false, error: extracted.error };
      }

      return { ok: true, count: Number(scValToNative(extracted.retval)) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Chain read get_plan_count failed: ${message}`);
      return { ok: false, error: message };
    }
  }
}
