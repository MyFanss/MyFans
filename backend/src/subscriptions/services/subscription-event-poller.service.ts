import {
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventBus } from '../../events/event-bus';
import {
  SubscriptionCreatedEvent,
  SubscriptionCancelledEvent,
  SubscriptionRenewedEvent,
} from '../../events/domain-events';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { resolveSubscriptionContractId } from '../../common/contract-deployed-env';
import { SubscriptionIndexEntity, SubscriptionStatus } from '../entities/subscription-index.entity';
import { SubscriptionIndexRepository, UpsertEventData } from '../repositories/subscription-index.repository';
import { SorobanRpcService } from '../../common/services/soroban-rpc.service';
import { RequestContextService } from '../../common/services/request-context.service';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { SubscriptionCacheService } from '../subscription-cache.service';
import { SubscriptionChainReaderService } from '../subscription-chain-reader.service';

const TARGET_EVENTS = ['subscribed', 'extended', 'cancelled'] as const;
type TargetEventType = typeof TARGET_EVENTS[number];

/**
 * Ledger clocks can lag/lead the wall clock slightly. Chain reads whose
 * skew exceeds this tolerance are still used (LedgerClockService already
 * skew-corrects the derived expiry), but we log loudly so it's visible in
 * monitoring rather than silently trusting a badly drifted ledger clock.
 */
const LEDGER_SKEW_TOLERANCE_MS = 60_000;

/** Raw chain event shape as received from SorobanRpcService.getNetworkEvents(). */
interface RawChainEvent {
  id: string;
  topic: unknown[];
  ledger: number;
  index: number;
  value: { xdr?: unknown };
  txHash?: string;
}

/** An event that has passed the contract/topic filter and is ready to be indexed. */
interface ParsedEvent {
  raw: RawChainEvent;
  ledgerSeq: number;
  eventIndex: number;
  eventType: TargetEventType;
  fan: string;
  creator: string;
  planId: number;
}

@Injectable()
export class SubscriptionEventPollerService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionEventPollerService.name);
  private contractId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly indexRepo: SubscriptionIndexRepository,
    private readonly eventBus: EventBus,
    private readonly sorobanRpc: SorobanRpcService,
    private readonly requestContext: RequestContextService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly chainReader: SubscriptionChainReaderService,
    @Optional()
    private readonly cache?: SubscriptionCacheService,
  ) {}

  async onModuleInit() {
    const id =
      resolveSubscriptionContractId() ??
      this.configService.get<string>('SUBSCRIPTION_CONTRACT_ID')?.trim();
    if (!id) {
      throw new Error(
        'Missing subscription contract ID. Set CONTRACT_ID_SUBSCRIPTION (preferred) or SUBSCRIPTION_CONTRACT_ID.',
      );
    }
    this.contractId = id;
    this.logger.log(`Poller initialized for contract: ${this.contractId}`);

    this.featureFlags.logPollerFlagResolution();

    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const isEnabled = this.featureFlags.isSorobanPollerEnabled();
    if (isEnabled && isProduction) {
      const rpcUrl = this.configService.get<string>('SOROBAN_RPC_URL')?.trim();
      if (!rpcUrl) {
        throw new Error(
          'Soroban poller is enabled in production but SOROBAN_RPC_URL is not configured. ' +
          'Either set SOROBAN_RPC_URL or disable the poller via FEATURE_SOROBAN_POLLER=false.',
        );
      }
    }
  }

  /**
   * Poll every 30 seconds for new events.
   * Reorg-safe via idempotency keys (ledgerSeq:eventIndex).
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async poll(): Promise<void> {
    const correlationId = uuidv4();
    await new Promise<void>((resolve, reject) =>
      this.requestContext.run(
        {
          correlationId,
          requestId: uuidv4(),
          method: 'CRON',
          url: 'subscription-event-poller',
          ip: 'internal',
        },
        () => this._poll().then(resolve, reject),
      ),
    );
  }

  private async _poll(): Promise<void> {
    if (!this.featureFlags.isSorobanPollerEnabled()) {
      this.logger.debug('Soroban poller disabled via feature flag; skipping.');
      return;
    }

    const startTime = Date.now();
    let processed = 0;
    let errors = 0;
    const counters = { created: 0, renewed: 0, cancelled: 0 };

    try {
      const checkpoint = await this.indexRepo.getLatestCheckpoint();
      let latestLedger: number;
      try {
        latestLedger = await this.sorobanRpc.getLatestLedgerSequence();
      } catch (rpcErr) {
        this.logger.warn(`getLatestLedgerSequence failed – skipping poll cycle: ${rpcErr}`);
        return;
      }

      if (latestLedger <= checkpoint) {
        this.logger.debug(`No new ledgers (checkpoint: ${checkpoint}, latest: ${latestLedger})`);
        return;
      }

      // Paginated fetch from checkpoint+1
      let cursor: string | undefined;
      do {
        let eventsResponse: Awaited<ReturnType<SorobanRpcService['getNetworkEvents']>>;
        try {
          eventsResponse = await this.sorobanRpc.getNetworkEvents({
            startLedger: checkpoint + 1,
            limit: 200,
            paginationToken: cursor,
          });
        } catch (rpcErr) {
          this.logger.warn(`getNetworkEvents failed – aborting page fetch: ${rpcErr}`);
          break;
        }

        const events = eventsResponse.events ?? [];
        this.logger.debug(`Fetched ${events.length} events from ${eventsResponse.startLedger}-${eventsResponse.latestLedger}`);

        const results = await this.processEventBatch(events as RawChainEvent[]);
        for (const result of results) {
          if (!result.ok) {
            errors++;
            continue;
          }
          processed++;
          counters[result.kind]++;
        }

        cursor = eventsResponse.nextToken;
      } while (cursor);

      const duration = Date.now() - startTime;
      const correlationId = this.requestContext.getCorrelationId();
      this.logger.log(
        `Poll complete: processed=${processed} (created=${counters.created}, renewed=${counters.renewed}, cancelled=${counters.cancelled}), errors=${errors}, checkpoint=${checkpoint} -> ${latestLedger}, duration=${duration}ms, correlationId=${correlationId}`,
      );
    } catch (error) {
      errors++;
      this.logger.error(`Poll failed: ${error}`);
    }
  }

  /**
   * Processes a page of raw chain events as a batch:
   *  1. Filters to our contract + target event types.
   *  2. Drops anything already indexed (idempotency on ledgerSeq:eventIndex),
   *     without spending an RPC call on it.
   *  3. Batches the remaining `subscribed`/`extended` events into concurrent
   *     chain-expiry reads via SubscriptionChainReaderService (the reader has
   *     no native multi-call batch endpoint, so "batching" here means firing
   *     the simulations concurrently rather than serially awaiting each one).
   *  4. Upserts + publishes a domain event per successfully-read event.
   */
  private async processEventBatch(
    events: RawChainEvent[],
  ): Promise<Array<{ ok: boolean; kind: 'created' | 'renewed' | 'cancelled' }>> {
    const parsed: ParsedEvent[] = [];

    for (const event of events) {
      const { id, topic } = event;
      if (!id || !topic) continue;
      const [ledgerSeq, eventIndex] = id.split(':').map(Number);

      if (topic[0] !== this.contractId) continue;
      const eventType = topic[1]?.toString();
      if (!TARGET_EVENTS.includes(eventType as any)) continue;

      // Already indexed? Idempotent — skip without touching the chain.
      const existing = await this.indexRepo.findByEventId(ledgerSeq, eventIndex);
      if (existing) continue;

      const fan = topic[2]?.toString() ?? '';
      const creator = topic[3]?.toString() ?? '';
      const data = event.value?.xdr ?? 0;

      parsed.push({
        raw: event,
        ledgerSeq,
        eventIndex,
        eventType: eventType as TargetEventType,
        fan,
        creator,
        planId: Number(data) || 0,
      });
    }

    if (parsed.length === 0) return [];

    // Batch the chain-expiry reads for subscribed/extended events concurrently.
    const needsExpiry = parsed.filter((p) => p.eventType !== 'cancelled');
    const expiryResults = await Promise.all(
      needsExpiry.map((p) => this.chainReader.readExpiryUnix(this.contractId, p.fan, p.creator)),
    );
    const expiryByKey = new Map<string, number | null>();
    needsExpiry.forEach((p, i) => {
      const key = `${p.ledgerSeq}:${p.eventIndex}`;
      const result = expiryResults[i];
      if (result.ok) {
        if (Math.abs(result.skewMs) > LEDGER_SKEW_TOLERANCE_MS) {
          this.logger.warn(
            `Ledger clock skew ${result.skewMs}ms exceeds tolerance (${LEDGER_SKEW_TOLERANCE_MS}ms) while reading expiry for ${p.fan.slice(0, 8)} -> ${p.creator.slice(0, 8)}; using skew-corrected value anyway.`,
          );
        }
        expiryByKey.set(key, result.expiryUnix);
      } else {
        this.logger.warn(
          `Chain expiry read failed for ${p.fan.slice(0, 8)} -> ${p.creator.slice(0, 8)}: ${result.error}. Will retry next poll cycle.`,
        );
        expiryByKey.set(key, null);
      }
    });

    const results: Array<{ ok: boolean; kind: 'created' | 'renewed' | 'cancelled' }> = [];

    for (const p of parsed) {
      try {
        let expiryUnix: number;
        let status: SubscriptionStatus = SubscriptionStatus.ACTIVE;

        if (p.eventType === 'cancelled') {
          status = SubscriptionStatus.CANCELLED;
          expiryUnix = Math.floor(Date.now() / 1000); // immediate
        } else {
          const key = `${p.ledgerSeq}:${p.eventIndex}`;
          const resolved = expiryByKey.get(key);
          if (resolved == null) {
            // Chain read failed — skip for now; next poll cycle retries since
            // this event hasn't been indexed yet (idempotency key untouched).
            results.push({ ok: false, kind: p.eventType === 'subscribed' ? 'created' : 'renewed' });
            continue;
          }
          expiryUnix = resolved;
        }

        const upsertData: UpsertEventData = {
          fan: p.fan,
          creator: p.creator,
          planId: p.planId,
          expiryUnix,
          status,
          ledgerSeq: p.ledgerSeq,
          eventIndex: p.eventIndex,
          txHash: p.raw.txHash,
          eventType: p.eventType,
        };

        const indexed = await this.indexRepo.upsertEvent(upsertData);

        // Chain state changed (subscribed/extended/cancelled) — bust any
        // cached gated-content check so the next request reflects it
        // immediately instead of waiting out the TTL.
        this.cache?.invalidate(p.fan, p.creator);

        // Publish domain event
        await this.publishDomainEvent(indexed);

        this.logger.debug(`Indexed ${p.eventType} ${p.fan.slice(0, 8)} -> ${p.creator.slice(0, 8)}`);
        results.push({
          ok: true,
          kind: p.eventType === 'subscribed' ? 'created' : p.eventType === 'extended' ? 'renewed' : 'cancelled',
        });
      } catch (err) {
        this.logger.warn(`Failed to process event ${p.ledgerSeq}:${p.eventIndex}: ${err}`);
        results.push({ ok: false, kind: p.eventType === 'subscribed' ? 'created' : p.eventType === 'extended' ? 'renewed' : 'cancelled' });
      }
    }

    return results;
  }

  /**
   * Publishes the correctly-typed domain event for an indexed chain event.
   * `subscribed` (first payment) and `extended` (renewal) are distinct so
   * downstream consumers (welcome notifications, referral bonuses, metrics)
   * only fire "first subscribe" behavior once, not on every renewal.
   */
  private publishDomainEvent(index: SubscriptionIndexEntity): void {
    const now = Math.floor(Date.now() / 1000);
    switch (index.eventType) {
      case 'subscribed':
        this.eventBus.publish(
          new SubscriptionCreatedEvent(
            index.fan,
            index.creator,
            index.planId,
            index.expiryUnix,
          ),
        );
        break;
      case 'extended':
        this.eventBus.publish(
          new SubscriptionRenewedEvent(
            index.id,
            index.fan,
            index.creator,
            index.planId,
            index.expiryUnix,
          ),
        );
        break;
      case 'cancelled':
        this.eventBus.publish(
          new SubscriptionCancelledEvent(
            index.id,
            index.fan,
            index.creator,
            index.planId,
            now,
          ),
        );
        break;
    }
  }
}
