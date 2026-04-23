import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionIndexRepository } from './repositories/subscription-index.repository';
import { SubscriptionIndexEntity, SubscriptionStatus } from './entities/subscription-index.entity';
import { SorobanRpcService } from '../common/services/soroban-rpc.service';
import { JobLoggerService } from '../common/services/job-logger.service';

export interface ReconcileResult {
  dryRun: boolean;
  scannedAt: string;
  totalScanned: number;
  staleFound: number;
  repaired: number;
  errors: number;
  records: ReconcileRecord[];
}

export interface ReconcileRecord {
  subscriptionId: string;
  fan: string;
  creator: string;
  localStatus: SubscriptionStatus;
  localExpiry: number;
  chainExpiry: number | null;
  staleCriteria: string;
  action: 'expire' | 'activate' | 'none' | 'skipped';
  applied: boolean;
  error?: string;
}

/** A subscription is stale when:
 *  1. status='active' but expiry is in the past (missed expiry update), OR
 *  2. status='active' but chain says it's expired/not found, OR
 *  3. status='expired' but chain says it's still active (re-activated on chain)
 */
@Injectable()
export class SubscriptionReconcilerService {
  private readonly logger = new Logger(SubscriptionReconcilerService.name);

  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly indexRepo: SubscriptionIndexRepository,
    private readonly soroban: SorobanRpcService,
    private readonly jobLogger: JobLoggerService,
  ) {}

  /** Scheduled: runs every hour in production */
  @Cron(CronExpression.EVERY_HOUR)
  async scheduledReconcile(): Promise<void> {
    const dryRun = process.env.RECONCILER_DRY_RUN === 'true';
    await this.reconcile(dryRun);
  }

  async reconcile(dryRun = false): Promise<ReconcileResult> {
    const job = this.jobLogger.start({
      queue: 'reconciler',
      jobName: 'subscription-reconcile',
      jobId: `reconcile-${Date.now()}`,
    });

    const result: ReconcileResult = {
      dryRun,
      scannedAt: new Date().toISOString(),
      totalScanned: 0,
      staleFound: 0,
      repaired: 0,
      errors: 0,
      records: [],
    };

    try {
      const allSubs = await this.indexRepo.findAllForReconciler();
      result.totalScanned = allSubs.length;

      const chainAvailable = await this.isChainAvailable();

      for (const sub of allSubs) {
        const record = await this.evaluateSubscription(sub, chainAvailable, dryRun);
        result.records.push(record);
        if (record.staleCriteria !== 'none') result.staleFound++;
        if (record.applied) result.repaired++;
        if (record.error) result.errors++;
      }

      this.logAudit(result);
      job.done();
    } catch (err) {
      job.done(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }

    return result;
  }

  private async evaluateSubscription(
    sub: SubscriptionIndexEntity,
    chainAvailable: boolean,
    dryRun: boolean,
  ): Promise<ReconcileRecord> {
    const nowSecs = Math.floor(Date.now() / 1000);
    const record: ReconcileRecord = {
      subscriptionId: sub.id,
      fan: sub.fan,
      creator: sub.creator,
      localStatus: sub.status,
      localExpiry: Number(sub.expiryUnix),
      chainExpiry: null,
      staleCriteria: 'none',
      action: 'none',
      applied: false,
    };

    try {
      // Criteria 1: active but past expiry in DB
      if (sub.status === SubscriptionStatus.ACTIVE && sub.expiryUnix < nowSecs) {
        record.staleCriteria = 'active-past-expiry';
        record.action = 'expire';
      }

      // Criteria 2 & 3: cross-check with chain if available
      if (chainAvailable) {
        const chainExpiry = await this.queryChainExpiry(sub.fan, sub.creator);
        record.chainExpiry = chainExpiry;

        if (sub.status === SubscriptionStatus.ACTIVE && chainExpiry !== null && chainExpiry < nowSecs) {
          record.staleCriteria = 'active-chain-expired';
          record.action = 'expire';
        } else if (sub.status === SubscriptionStatus.EXPIRED && chainExpiry !== null && chainExpiry > nowSecs) {
          record.staleCriteria = 'expired-chain-active';
          record.action = 'activate';
        }
      }

      if (record.action === 'none' || record.action === 'skipped') return record;

      if (!dryRun) {
        this.applyRepair(sub.fan, sub.creator, record.action, record.chainExpiry);
        record.applied = true;
      } else {
        record.applied = false; // dry-run: would have applied
      }
    } catch (err) {
      record.error = err instanceof Error ? err.message : String(err);
      this.logger.error(
        JSON.stringify({ event: 'reconcile.record.error', subscriptionId: sub.id, error: record.error }),
      );
    }

    return record;
  }

  private async applyRepair(
    fan: string,
    creator: string,
    action: 'expire' | 'activate',
    chainExpiry: number | null,
  ): Promise<void> {
    if (action === 'expire') {
      await this.subscriptions.expireSubscription(fan, creator);
    } else if (action === 'activate' && chainExpiry !== null) {
      const sub = await this.subscriptions.getSubscription(fan, creator);
      if (sub) {
        await this.subscriptions.renewSubscription(fan, creator, sub.planId, chainExpiry);
      }
    }
  }

  private async isChainAvailable(): Promise<boolean> {
    try {
      const health = await this.soroban.checkConnectivity();
      return health.status === 'up';
    } catch {
      return false;
    }
  }

  /** In production this would call the Soroban contract's is_subscriber / expiry view.
   *  Returns expiry timestamp in seconds, or null if not found on chain. */
  private async queryChainExpiry(fan: string, creator: string): Promise<number | null> {
    // Stub: real impl would call soroban contract read via SorobanRpcService
    void fan; void creator;
    return null;
  }

  private logAudit(result: ReconcileResult): void {
    this.logger.log(
      JSON.stringify({
        event: 'reconcile.completed',
        dryRun: result.dryRun,
        scannedAt: result.scannedAt,
        totalScanned: result.totalScanned,
        staleFound: result.staleFound,
        repaired: result.repaired,
        errors: result.errors,
      }),
    );

    for (const r of result.records) {
      if (r.staleCriteria !== 'none') {
        this.logger.log(
          JSON.stringify({
            event: 'reconcile.record',
            subscriptionId: r.subscriptionId,
            fan: r.fan,
            creator: r.creator,
            staleCriteria: r.staleCriteria,
            action: r.action,
            applied: r.applied,
            dryRun: result.dryRun,
            ...(r.error && { error: r.error }),
          }),
        );
      }
    }
  }
}
