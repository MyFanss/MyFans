import { Injectable, Logger, Optional } from '@nestjs/common';
import { SubscriptionIndexRepository } from '../repositories/subscription-index.repository';
import { SubscriptionIndexEntity, SubscriptionStatus } from '../entities/subscription-index.entity';
import { SubscriptionChainReaderService } from '../subscription-chain-reader.service';

export interface ChainSyncRecord {
  subscriptionId: string;
  fan: string;
  creator: string;
  localStatus: SubscriptionStatus;
  localExpiryUnix: number;
  chainIsSubscriber: boolean | null;
  chainExpiryUnix: number | null;
  chainError?: string;
  action: 'activate' | 'expire' | 'none' | 'skipped';
  applied: boolean;
  error?: string;
}

export interface ChainSyncResult {
  dryRun: boolean;
  syncedAt: string;
  contractId: string | null;
  totalScanned: number;
  activated: number;
  expired: number;
  skipped: number;
  errors: number;
  records: ChainSyncRecord[];
}

/**
 * SubscriptionChainSyncService
 *
 * Syncs local subscription index state against the on-chain contract state.
 * For each indexed subscription it:
 *   1. Reads `is_subscriber(fan, creator)` from the contract.
 *   2. Optionally reads `get_expiry_unix(fan, creator)` for precise expiry.
 *   3. Reconciles local status with chain truth:
 *      - local=active  + chain=not-subscriber → expire locally
 *      - local=expired + chain=subscriber     → re-activate locally
 *      - local=active  + chain=subscriber     → no-op (already in sync)
 *
 * All chain reads are best-effort: if the chain reader is unavailable or
 * returns an error the record is marked 'skipped' and processing continues.
 *
 * Stale / disconnected states are handled gracefully — a chain read failure
 * never causes the sync to abort; it only marks that record as skipped.
 */
@Injectable()
export class SubscriptionChainSyncService {
  private readonly logger = new Logger(SubscriptionChainSyncService.name);

  constructor(
    private readonly indexRepo: SubscriptionIndexRepository,
    @Optional()
    private readonly chainReader?: SubscriptionChainReaderService,
  ) {}

  /**
   * Sync all indexed subscriptions against the chain.
   *
   * @param dryRun  When true, evaluates what would change but does not write.
   * @param fanFilter  Optional: only sync subscriptions for this fan address.
   */
  async sync(dryRun = false, fanFilter?: string): Promise<ChainSyncResult> {
    const contractId = this.chainReader?.getConfiguredContractId() ?? null;

    const result: ChainSyncResult = {
      dryRun,
      syncedAt: new Date().toISOString(),
      contractId,
      totalScanned: 0,
      activated: 0,
      expired: 0,
      skipped: 0,
      errors: 0,
      records: [],
    };

    if (!contractId || !this.chainReader) {
      this.logger.warn(
        'SubscriptionChainSyncService: no contract ID configured — sync skipped',
      );
      return result;
    }

    const allSubs = fanFilter
      ? await this.indexRepo.listActiveForFan(fanFilter)
      : await this.indexRepo.findAllForReconciler();

    result.totalScanned = allSubs.length;

    for (const sub of allSubs) {
      const record = await this.evaluateAndApply(sub, contractId, dryRun);
      result.records.push(record);

      if (record.action === 'skipped' || record.error) {
        result.skipped++;
      } else if (record.action === 'activate' && record.applied) {
        result.activated++;
      } else if (record.action === 'expire' && record.applied) {
        result.expired++;
      }

      if (record.error) {
        result.errors++;
      }
    }

    this.logSummary(result);
    return result;
  }

  private async evaluateAndApply(
    sub: SubscriptionIndexEntity,
    contractId: string,
    dryRun: boolean,
  ): Promise<ChainSyncRecord> {
    const nowSecs = Math.floor(Date.now() / 1000);

    const record: ChainSyncRecord = {
      subscriptionId: sub.id,
      fan: sub.fan,
      creator: sub.creator,
      localStatus: sub.status,
      localExpiryUnix: Number(sub.expiryUnix),
      chainIsSubscriber: null,
      chainExpiryUnix: null,
      action: 'none',
      applied: false,
    };

    // Cancelled subscriptions are terminal — skip chain check
    if (sub.status === SubscriptionStatus.CANCELLED) {
      record.action = 'skipped';
      return record;
    }

    try {
      // Step 1: is_subscriber check
      const isSubResult = await this.chainReader!.readIsSubscriber(
        contractId,
        sub.fan,
        sub.creator,
      );

      if (!isSubResult.ok) {
        record.chainError = isSubResult.error;
        record.action = 'skipped';
        this.logger.warn(
          `chain-sync: is_subscriber failed for ${sub.id}: ${isSubResult.error}`,
        );
        return record;
      }

      record.chainIsSubscriber = isSubResult.isSubscriber;

      // Step 2: optionally read expiry for precise timestamp
      if (isSubResult.isSubscriber) {
        const expiryResult = await this.chainReader!.readExpiryUnix(
          contractId,
          sub.fan,
          sub.creator,
        );
        if (expiryResult.ok) {
          record.chainExpiryUnix = expiryResult.expiryUnix;
        }
        // Expiry read failure is non-fatal — we still know the sub is active
      }

      // Step 3: determine action
      const localIsActive =
        sub.status === SubscriptionStatus.ACTIVE && Number(sub.expiryUnix) > nowSecs;

      if (localIsActive && !isSubResult.isSubscriber) {
        // Local says active but chain says not subscribed → expire
        record.action = 'expire';
      } else if (!localIsActive && isSubResult.isSubscriber) {
        // Local says expired/inactive but chain says subscribed → re-activate
        record.action = 'activate';
      } else {
        record.action = 'none';
      }

      // Step 4: apply (unless dry-run)
      if (record.action !== 'none' && !dryRun) {
        await this.applyAction(sub, record);
        record.applied = true;
      }
    } catch (err) {
      record.error = err instanceof Error ? err.message : String(err);
      record.action = 'skipped';
      this.logger.error(
        `chain-sync: unexpected error for subscription ${sub.id}: ${record.error}`,
      );
    }

    return record;
  }

  private async applyAction(
    sub: SubscriptionIndexEntity,
    record: ChainSyncRecord,
  ): Promise<void> {
    if (record.action === 'expire') {
      await this.indexRepo.updateStatus(
        sub.fan,
        sub.creator,
        SubscriptionStatus.EXPIRED,
      );
      this.logger.log(
        `chain-sync: expired subscription ${sub.id} (chain says not-subscriber)`,
      );
    } else if (record.action === 'activate') {
      const newExpiry =
        record.chainExpiryUnix ??
        Math.floor(Date.now() / 1000) + 30 * 24 * 3600; // fallback: +30 days

      await this.indexRepo.upsertManual({
        fan: sub.fan,
        creator: sub.creator,
        planId: sub.planId,
        expiryUnix: newExpiry,
        status: SubscriptionStatus.ACTIVE,
      });
      this.logger.log(
        `chain-sync: re-activated subscription ${sub.id} (chain says subscriber, expiry=${newExpiry})`,
      );
    }
  }

  private logSummary(result: ChainSyncResult): void {
    this.logger.log(
      JSON.stringify({
        event: 'chain-sync.completed',
        dryRun: result.dryRun,
        contractId: result.contractId,
        syncedAt: result.syncedAt,
        totalScanned: result.totalScanned,
        activated: result.activated,
        expired: result.expired,
        skipped: result.skipped,
        errors: result.errors,
      }),
    );
  }
}
