import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatorOnchainMapping } from './entities/creator-onchain-mapping.entity';
import { BusinessMetricsService } from '../metrics/business-metrics.service';

export interface ReconcileRecord {
  creatorId: string;
  stellarAddress: string;
  storedOnchainId: string;
  chainOnchainId: string | null;
  drift: boolean;
  error?: string;
}

export interface ReconcileResult {
  dryRun: boolean;
  scannedAt: string;
  totalScanned: number;
  driftFound: number;
  repaired: number;
  errors: number;
  records: ReconcileRecord[];
}

/**
 * Keeps `creator_onchain_mappings` (the off-chain CreatorProfile ↔ on-chain
 * `creator-registry` `creator_id` link) in sync (#1454).
 *
 * - `syncOnOnboard` is called when a creator completes on-chain registration
 *   (i.e. after `creator-registry.register_creator` succeeds) and writes/
 *   updates the mapping.
 * - `reconcile` periodically re-reads the chain's view of `creator_id` for
 *   every mapped creator and flags any drift between the stored value and
 *   the chain, following the same shape as `SubscriptionReconcilerService`.
 */
@Injectable()
export class CreatorRegistrySyncService {
  private readonly logger = new Logger(CreatorRegistrySyncService.name);

  constructor(
    @InjectRepository(CreatorOnchainMapping)
    private readonly mappingRepository: Repository<CreatorOnchainMapping>,
    @Optional()
    private readonly businessMetrics?: BusinessMetricsService,
  ) {}

  /**
   * Write (or update) the mapping between `creatorId` and the on-chain
   * `creator_id` for `stellarAddress`. Called on onboarding, i.e. right after
   * the creator-registry contract's `register_creator` succeeds.
   *
   * Idempotent: re-onboarding the same creator with the same on-chain ID is a
   * no-op beyond bumping `last_synced_at`; a changed on-chain ID overwrites
   * the stored value and clears any previously flagged drift.
   */
  async syncOnOnboard(
    creatorId: string,
    stellarAddress: string,
    onchainCreatorId: string,
  ): Promise<CreatorOnchainMapping> {
    const existing = await this.mappingRepository.findOne({ where: { creator_id: creatorId } });

    const mapping =
      existing ??
      this.mappingRepository.create({
        creator_id: creatorId,
      });

    mapping.stellar_address = stellarAddress;
    mapping.onchain_creator_id = onchainCreatorId;
    mapping.last_synced_at = new Date();
    mapping.drift_detected_at = null;

    const saved = await this.mappingRepository.save(mapping);

    this.logger.log(
      JSON.stringify({
        event: 'creator_registry.synced',
        creatorId,
        stellarAddress,
        onchainCreatorId,
      }),
    );

    return saved;
  }

  async getMapping(creatorId: string): Promise<CreatorOnchainMapping | null> {
    return this.mappingRepository.findOne({ where: { creator_id: creatorId } });
  }

  /** Scheduled: runs every hour in production, mirroring SubscriptionReconcilerService. */
  @Cron(CronExpression.EVERY_HOUR)
  async scheduledReconcile(): Promise<void> {
    const dryRun = process.env.CREATOR_REGISTRY_RECONCILER_DRY_RUN === 'true';
    await this.reconcile(dryRun);
  }

  async reconcile(dryRun = false): Promise<ReconcileResult> {
    const result: ReconcileResult = {
      dryRun,
      scannedAt: new Date().toISOString(),
      totalScanned: 0,
      driftFound: 0,
      repaired: 0,
      errors: 0,
      records: [],
    };

    const mappings = await this.mappingRepository.find();
    result.totalScanned = mappings.length;

    for (const mapping of mappings) {
      const record = await this.evaluateMapping(mapping, dryRun);
      result.records.push(record);
      if (record.drift) result.driftFound++;
      if (record.error) result.errors++;
    }

    // Expose the latest drift count as a Prometheus gauge so registry
    // divergence is observable without parsing audit logs.
    this.businessMetrics?.recordCreatorRegistryDrift(result.driftFound);

    this.logAudit(result);
    return result;
  }

  private async evaluateMapping(
    mapping: CreatorOnchainMapping,
    dryRun: boolean,
  ): Promise<ReconcileRecord> {
    const record: ReconcileRecord = {
      creatorId: mapping.creator_id,
      stellarAddress: mapping.stellar_address,
      storedOnchainId: mapping.onchain_creator_id,
      chainOnchainId: null,
      drift: false,
    };

    try {
      const chainOnchainId = await this.queryOnchainCreatorId(mapping.stellar_address);
      record.chainOnchainId = chainOnchainId;

      // Drift: the chain has a value and it disagrees with what we stored
      // (including the chain no longer having a registration at all).
      if (chainOnchainId !== mapping.onchain_creator_id) {
        record.drift = true;

        if (!dryRun) {
          mapping.drift_detected_at = new Date();
          await this.mappingRepository.save(mapping);
          this.repaired(record);
        }
      }
    } catch (err) {
      record.error = err instanceof Error ? err.message : String(err);
      this.logger.error(
        JSON.stringify({
          event: 'creator_registry.reconcile.error',
          creatorId: mapping.creator_id,
          error: record.error,
        }),
      );
    }

    return record;
  }

  private repaired(record: ReconcileRecord): void {
    // Marking drift_detected_at (done by the caller) is the repair for now —
    // resolving the drift (deciding which side is authoritative and writing
    // back) is an operator/manual-review action. Tracked as a follow-up once
    // `queryOnchainCreatorId` below is backed by a real contract read.
    void record;
  }

  /**
   * Read the creator-registry contract's `get_creator_id(address)` for
   * `stellarAddress`.
   *
   * Stub: a real implementation would call this via a Soroban RPC client
   * (see `SorobanRpcService` / `SubscriptionChainReaderService` for the
   * established pattern elsewhere in this backend) against the deployed
   * `creator-registry` contract. Always returning `null` here means
   * `reconcile()` currently flags every mapped creator as drifted until this
   * is wired up — callers/tests should inject their own behavior by mocking
   * this method.
   */
  protected async queryOnchainCreatorId(stellarAddress: string): Promise<string | null> {
    void stellarAddress;
    return null;
  }

  private logAudit(result: ReconcileResult): void {
    this.logger.log(
      JSON.stringify({
        event: 'creator_registry.reconcile.completed',
        dryRun: result.dryRun,
        scannedAt: result.scannedAt,
        totalScanned: result.totalScanned,
        driftFound: result.driftFound,
        errors: result.errors,
      }),
    );
  }
}
