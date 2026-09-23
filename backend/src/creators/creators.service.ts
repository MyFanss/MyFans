import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Creator } from './entities/creator.entity';
import { CreatorRegistryEvent } from './entities/creator-registry-event.entity';

/**
 * Event schema version for forward compatibility.
 * Bump when the on-chain registry event payload shape changes.
 */
export const CREATOR_REGISTRY_EVENT_SCHEMA_VERSION = 1;

export type CreatorRegistryEventKind = 'CreatorRegistered' | 'CreatorUpdated';

export interface CreatorRegistryEventPayload {
  /** Event schema version for forward compat. */
  schemaVersion: number;
  /** On-chain event kind. */
  kind: CreatorRegistryEventKind;
  /** Creator public key (canonical identity). */
  creator: string;
  /** Metadata hash or CID only — never raw PII. */
  metadataHashOrUri: string;
  /** Optional admin force-suspend flag from the moderation bridge. */
  forceSuspended?: boolean;
  /** Ledger sequence number of the emitting transaction. */
  ledgerSeq: number;
  /** Index of the event within the ledger transaction. */
  eventIndex: number;
}

@Injectable()
export class CreatorsService {
  private readonly logger = new Logger(CreatorsService.name);

  constructor(
    @InjectRepository(Creator)
    private readonly creatorsRepository: Repository<Creator>,
    @InjectRepository(CreatorRegistryEvent)
    private readonly registryEventsRepository: Repository<CreatorRegistryEvent>,
  ) {}

  /**
   * Idempotently sync a single on-chain registry event into the DB.
   *
   * Identity is `ledgerSeq:eventIndex`; duplicate delivery of the same event
   * results in a single row (upsert by pubkey, dedupe by event identity).
   */
  async syncRegistryEvent(payload: CreatorRegistryEventPayload): Promise<Creator> {
    const eventId = `${payload.ledgerSeq}:${payload.eventIndex}`;

    const existingEvent = await this.registryEventsRepository.findOne({
      where: { eventId },
    });
    if (existingEvent) {
      this.logger.debug(`Duplicate registry event ${eventId} ignored`);
      return this.creatorsRepository.findOneOrFail({
        where: { pubkey: payload.creator },
      });
    }

    await this.registryEventsRepository.save(
      this.registryEventsRepository.create({
        eventId,
        schemaVersion: payload.schemaVersion ?? CREATOR_REGISTRY_EVENT_SCHEMA_VERSION,
        kind: payload.kind,
        creator: payload.creator,
        metadataHashOrUri: payload.metadataHashOrUri,
        ledgerSeq: payload.ledgerSeq,
        eventIndex: payload.eventIndex,
      }),
    );

    let creator = await this.creatorsRepository.findOne({
      where: { pubkey: payload.creator },
    });

    if (!creator) {
      creator = this.creatorsRepository.create({
        pubkey: payload.creator,
        metadataHashOrUri: payload.metadataHashOrUri,
        forceSuspended: payload.forceSuspended ?? false,
      });
    } else {
      creator.metadataHashOrUri = payload.metadataHashOrUri;
      if (payload.forceSuspended !== undefined) {
        creator.forceSuspended = payload.forceSuspended;
      }
    }

    return this.creatorsRepository.save(creator);
  }

  /**
   * Sync a batch of registry events. Safe to call with overlapping ranges;
   * each event is deduped on `ledgerSeq:eventIndex`.
   */
  async syncRegistryEvents(
    payloads: CreatorRegistryEventPayload[],
  ): Promise<Creator[]> {
    const results: Creator[] = [];
    for (const payload of payloads) {
      results.push(await this.syncRegistryEvent(payload));
    }
    return results;
  }

  async findByPubkey(pubkey: string): Promise<Creator | null> {
    return this.creatorsRepository.findOne({ where: { pubkey } });
  }
}
