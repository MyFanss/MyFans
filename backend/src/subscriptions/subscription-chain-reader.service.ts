import { Injectable, Logger } from '@nestjs/common';
import {
  Account,
  Address,
  Contract,
  Networks,
  rpc,
  scValToNative,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { CircuitOpenError, withRetry } from '../common/utils/rpc-retry';
import { resolveSubscriptionContractId } from '../common/contract-deployed-env';

export type ChainReadResult =
  | { ok: true; isSubscriber: boolean }
  | { ok: false; error: string };

export type ChainPlanReadResult =
  | { ok: true; plan: { creator: string; asset: string; amount: string; intervalDays: number } }
  | { ok: false; error: string };

export type ChainPlanCountReadResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

/**
 * Read-only Soroban simulation of the subscription contract `is_subscriber` method.
 * Skipped when no contract id is configured.
 */
@Injectable()
export class SubscriptionChainReaderService {
  private readonly logger = new Logger(SubscriptionChainReaderService.name);

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

  /**
   * Simulates `is_subscriber(fan, creator)` on the deployed subscription contract.
   */
  async readIsSubscriber(
    contractId: string,
    fan: string,
    creator: string,
  ): Promise<ChainReadResult> {
    const rpcUrl = this.getRpcUrl();
    const server = new rpc.Server(rpcUrl, {
      allowHttp: rpcUrl.startsWith('http://'),
    });

    try {
      const contract = new Contract(contractId);
      const fanAddr = Address.fromString(fan);
      const creatorAddr = Address.fromString(creator);
      const op = contract.call(
        'is_subscriber',
        fanAddr.toScVal(),
        creatorAddr.toScVal(),
      );

      const source = new Account(
        'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        '1',
      );

      const tx = new TransactionBuilder(source, {
        fee: '100000',
        networkPassphrase: this.getNetworkPassphrase(),
      })
        .addOperation(op)
        .setTimeout(30)
        .build();

      const sim = await withRetry(
        'soroban-rpc',
        () => server.simulateTransaction(tx),
        {
          isPermanentError: (e) =>
            e instanceof CircuitOpenError ||
            (e instanceof Error && /invalid contract|not found/i.test(e.message)),
        },
      );

      if (rpc.Api.isSimulationError(sim)) {
        return { ok: false, error: sim.error };
      }

      if (!sim.result?.retval) {
        return {
          ok: false,
          error: 'Simulation succeeded but returned no retval (unexpected).',
        };
      }

      const native = scValToNative(sim.result.retval);
      return { ok: true, isSubscriber: Boolean(native) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Chain read is_subscriber failed: ${message}`);
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
    const rpcUrl = this.getRpcUrl();
    const server = new rpc.Server(rpcUrl, {
      allowHttp: rpcUrl.startsWith('http://'),
    });

    try {
      const contract = new Contract(contractId);
      const op = contract.call('get_plan', new Api.UInt32Val(planId).toScVal());

      const source = new Account(
        'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        '1',
      );

      const tx = new TransactionBuilder(source, {
        fee: '100000',
        networkPassphrase: this.getNetworkPassphrase(),
      })
        .addOperation(op)
        .setTimeout(30)
        .build();

      const sim = await server.simulateTransaction(tx);

      if (Api.isSimulationError(sim)) {
        return { ok: false, error: sim.error };
      }

      if (!sim.result?.retval) {
        return {
          ok: false,
          error: 'Simulation succeeded but returned no retval (unexpected).',
        };
      }

      const native = scValToNative(sim.result.retval);
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
    const rpcUrl = this.getRpcUrl();
    const server = new rpc.Server(rpcUrl, {
      allowHttp: rpcUrl.startsWith('http://'),
    });

    try {
      const contract = new Contract(contractId);
      const op = contract.call('get_plan_count');

      const source = new Account(
        'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        '1',
      );

      const tx = new TransactionBuilder(source, {
        fee: '100000',
        networkPassphrase: this.getNetworkPassphrase(),
      })
        .addOperation(op)
        .setTimeout(30)
        .build();

      const sim = await server.simulateTransaction(tx);

      if (Api.isSimulationError(sim)) {
        return { ok: false, error: sim.error };
      }

      if (!sim.result?.retval) {
        return {
          ok: false,
          error: 'Simulation succeeded but returned no retval (unexpected).',
        };
      }

      const native = scValToNative(sim.result.retval);
      return { ok: true, count: Number(native) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Chain read get_plan_count failed: ${message}`);
      return { ok: false, error: message };
    }
  }
}
