import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventBus } from '../../events/event-bus';
import {
  SubscriptionCancelledEvent,
  SubscriptionRenewedEvent,
} from '../../events/domain-events';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { resolveSubscriptionContractId } from '../../common/contract-deployed-env';
import { SubscriptionIndexEntity, SubscriptionStatus } from '../entities/subscription-index.entity';
import { SubscriptionIndexRepository, UpsertEventData } from '../repositories/subscription-index.repository';
import { SorobanRpcService } from '../../common/services/soroban-rpc.service'; // Assumed to exist
import { RequestContextService } from '../../common/services/request-context.service';

const TARGET_EVENTS = ['subscribed', 'extended', 'cancelled'] as const;
type TargetEventType = typeof TARGET_EVENTS[number];

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
    const startTime = Date.now();
    let processed = 0;
    let errors = 0;

    try {
      const checkpoint = await this.indexRepo.getLatestCheckpoint();
      const latestLedger = await (this.sorobanRpc as any).getLatestLedgerSequence();
      
      if (latestLedger <= checkpoint) {
        this.logger.debug(`No new ledgers (checkpoint: ${checkpoint}, latest: ${latestLedger})`);
        return;
      }

      // Paginated fetch from checkpoint+1
      let cursor: string | undefined;
      do {
          const eventsResponse = await (this.sorobanRpc as any).getNetworkEvents({
          startLedger: checkpoint + 1,
          limit: 200,
          paginationToken: cursor,
        });

        const events = eventsResponse.events ?? [];
        this.logger.debug(`Fetched ${events.length} events from ${eventsResponse.startLedger}-${eventsResponse.latestLedger}`);

        for (const event of events) {
          if (await this.processEvent(event)) {
            processed++;
          }
        }

        cursor = eventsResponse.nextToken;
      } while (cursor);

      const duration = Date.now() - startTime;
      const correlationId = this.requestContext.getCorrelationId();
      this.logger.log(`Poll complete: processed=${processed}, errors=${errors}, checkpoint=${checkpoint} -> ${latestLedger}, duration=${duration}ms, correlationId=${correlationId}`);
    } catch (error) {
      errors++;
      this.logger.error(`Poll failed: ${error}`);
    }
  }

  private async processEvent(event: any): Promise<boolean> {
    const { id, topic, ledger, index, value } = event;
    const [ledgerSeq, eventIndex] = id.split(':').map(Number);

    // Filter: our contract, target events
    if (!topic || topic[0] !== this.contractId) return false;
    const eventType = topic[1]?.toString();
    if (!TARGET_EVENTS.includes(eventType as any)) return false;

    try {
      // Already indexed? Idempotent
      const existing = await this.indexRepo.findByEventId(ledgerSeq, eventIndex);
      if (existing) return true;

      // Parse: topics: [contract, type, fan, creator], data: plan_id or true
      const fan = topic[2]?.toString() ?? '';
      const creator = topic[3]?.toString() ?? '';
      const data = value?.xdr ?? {}; // Plan ID u32

      let planId: number = 0;
      let expiryUnix: number;
      let status: SubscriptionStatus = SubscriptionStatus.ACTIVE;

      if (eventType === 'cancelled') {
        status = SubscriptionStatus.CANCELLED;
        expiryUnix = Math.floor(Date.now() / 1000); // immediate
      } else {
        // subscribed/extended: need expiry from contract view
        // TODO: batch invoke is_subscriber?expiry for fan/creator
        // Stub: fetch expiry
        expiryUnix = await this.fetchExpiryFromChain(fan, creator);
        planId = Number(data) || 0;
      }

      const upsertData: UpsertEventData = {
        fan,
        creator,
        planId,
        expiryUnix,
        status,
        ledgerSeq,
        eventIndex,
        txHash: event.txHash, // if avail
        eventType: eventType as any,
      };

      const indexed = await this.indexRepo.upsertEvent(upsertData);

      // Publish domain event
      await this.publishDomainEvent(indexed);

      this.logger.debug(`Indexed ${eventType} ${fan.slice(0,8)} -> ${creator.slice(0,8)}`);
      return true;
    } catch (err) {
      this.logger.warn(`Failed to process event ${ledgerSeq}:${eventIndex}: ${err}`);
      return false;
    }
  }

  private async fetchExpiryFromChain(fan: string, creator: string): Promise<number> {
    // Integrate with SubscriptionChainReaderService or direct RPC invoke
    // Stub for now - implement read_subscriber_expiry view
    return Math.floor(Date.now() / 1000) + 30 * 24 * 3600; // 30 days
  }

  private async publishDomainEvent(index: SubscriptionIndexEntity): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    switch (index.eventType) {
      case 'subscribed':
      case 'extended':
        this.eventBus.publish(
          new SubscriptionRenewedEvent( // or Created if no prior
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
