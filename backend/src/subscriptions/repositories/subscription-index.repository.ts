import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionIndexEntity, SubscriptionStatus } from '../entities/subscription-index.entity';

export interface UpsertEventData {
  fan: string;
  creator: string;
  planId: number;
  expiryUnix: number;
  status: SubscriptionStatus;
  ledgerSeq: number;
  eventIndex: number;
  txHash?: string;
  eventType: 'subscribed' | 'extended' | 'cancelled';
}

export interface UpsertManualData {
  fan: string;
  creator: string;
  planId: number;
  expiryUnix: number;
  status: SubscriptionStatus;
  /**
   * Ledger sequence this write is derived from, if known (e.g. the ledger a
   * verified on-chain confirmation landed in). Defaults to -1 ("no chain
   * evidence") for purely off-chain writes. Chain events indexed by the
   * poller are the source of truth: a manual write is never allowed to
   * clobber a row that already reflects a higher ledgerSeq.
   */
  ledgerSeq?: number;
}

@Injectable()
export class SubscriptionIndexRepository {
  private readonly logger = new Logger(SubscriptionIndexRepository.name);

  constructor(
    @InjectRepository(SubscriptionIndexEntity)
    private readonly repo: Repository<SubscriptionIndexEntity>,
  ) {}

  async upsertEvent(data: UpsertEventData): Promise<SubscriptionIndexEntity> {
    const entity = this.repo.create(data);
    try {
      return await this.repo.save(entity);
    } catch (error) {
      // Idempotency: unique violation on (ledgerSeq, eventIndex) → ignore and fetch existing
      if (error instanceof Error && 'code' in error && error.code === '23505') {
        this.logger.warn(
          `Duplicate event delivery detected: ledger ${data.ledgerSeq}:${data.eventIndex} already indexed; ` +
          `this is expected under at-least-once RPC delivery and has been deduplicated.`,
        );
        // Fetch existing to return to caller
        const existing = await this.findByEventId(data.ledgerSeq, data.eventIndex);
        if (!existing) throw error;
        return existing;
      }
      throw error;
    }
  }

  async upsertManual(data: UpsertManualData): Promise<SubscriptionIndexEntity> {
    // Upsert on (fan, creator) - keep latest, but never let an off-chain
    // write (checkout confirmation, reconciler fill-gap repair) clobber a
    // row that chain events (indexed by the poller) already advanced past.
    // Guard: only apply if incoming ledgerSeq >= the currently stored one.
    const existing = await this.findCurrentForFanCreator(data.fan, data.creator);
    const incomingLedgerSeq = data.ledgerSeq ?? -1;
    if (existing && existing.ledgerSeq > incomingLedgerSeq) {
      this.logger.warn(
        `Skipped stale write for ${data.fan}->${data.creator}: existing ledgerSeq ${existing.ledgerSeq} > incoming ${incomingLedgerSeq}`,
      );
      return existing;
    }

    const entity = this.repo.create({
      ...data,
      ledgerSeq: incomingLedgerSeq,
      eventIndex: -1,
      eventType: 'manual',
    });
    if (existing) {
      entity.id = existing.id; // update
    }
    return this.repo.save(entity);
  }

  async findByEventId(ledgerSeq: number, eventIndex: number): Promise<SubscriptionIndexEntity | null> {
    return this.repo.findOne({
      where: { ledgerSeq, eventIndex },
    });
  }

  async findCurrentForFanCreator(fan: string, creator: string): Promise<SubscriptionIndexEntity | null> {
    return this.repo.findOne({
      where: { fan, creator },
      order: { indexedAt: 'DESC' },
    });
  }

  async findAndCountForFan(
    fan: string,
    status: SubscriptionStatus | undefined,
    sort: string | undefined,
    page: number,
    limit: number,
  ): Promise<[SubscriptionIndexEntity[], number]> {
    const where = status ? { fan, status } : { fan };
    return this.repo.findAndCount({
      where,
      order: sort === 'created' ? { createdAt: 'DESC' } : { expiryUnix: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async listForCreator(creator: string): Promise<SubscriptionIndexEntity[]> {
    return this.repo.find({
      where: { creator },
      order: { createdAt: 'DESC' },
    });
  }

  async listActiveForFan(fan: string, page: number = 1, limit: number = 20): Promise<SubscriptionIndexEntity[]> {
    const qb = this.repo.createQueryBuilder('sub')
      .where('sub.fan = :fan', { fan })
      .andWhere('sub.status = :active', { active: SubscriptionStatus.ACTIVE })
      .orderBy('sub.indexedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    return qb.getMany();
  }

  async getLatestCheckpoint(): Promise<number> {
    const res = await this.repo
      .createQueryBuilder('sub')
      .select('MAX(sub.ledgerSeq)', 'maxLedger')
      .getRawOne();
    return res?.maxLedger ?? 0;
  }

  /**
   * Updates the status of the fan/creator's currently-active row.
   *
   * `minLedgerSeq`, when provided, guards the write so it only applies if
   * the stored row's ledgerSeq has not moved past it since it was read
   * (optimistic concurrency) — used by the reconciler so it can never
   * overwrite fresher poller-indexed data with a stale repair.
   */
  async updateStatus(
    fan: string,
    creator: string,
    status: SubscriptionStatus,
    expiryUnix?: number,
    minLedgerSeq?: number,
  ): Promise<void> {
    const qb = this.repo
      .createQueryBuilder()
      .update(SubscriptionIndexEntity)
      .set({ status, expiryUnix: expiryUnix ?? 0, updatedAt: new Date() })
      .where('"fan" = :fan', { fan })
      .andWhere('"creator" = :creator', { creator })
      .andWhere('"status" = :activeStatus', { activeStatus: SubscriptionStatus.ACTIVE });

    if (minLedgerSeq !== undefined) {
      qb.andWhere('"ledgerSeq" <= :minLedgerSeq', { minLedgerSeq });
    }

    await qb.execute();
  }

  async isSubscriber(fan: string, creator: string): Promise<boolean> {
    const sub = await this.findCurrentForFanCreator(fan, creator);
    if (!sub) return false;
    return sub.expiryUnix > Math.floor(Date.now() / 1000);
  }

  async getAllActive(): Promise<SubscriptionIndexEntity[]> {
    return this.repo.find({
      where: { status: SubscriptionStatus.ACTIVE },
      order: { expiryUnix: 'ASC' },
    });
  }

  async findAllForReconciler(): Promise<SubscriptionIndexEntity[]> {
    return this.repo.find({
      order: { indexedAt: 'DESC' },
    });
  }

  async findWithCursor(
    fan: string,
    status: SubscriptionStatus | undefined,
    sort: string | undefined,
    cursorId: string | undefined,
    limit: number,
  ): Promise<SubscriptionIndexEntity[]> {
    const qb = this.repo
      .createQueryBuilder('sub')
      .where('sub.fan = :fan', { fan })
      .orderBy(sort === 'created' ? 'sub.createdAt' : 'sub.expiryUnix', 'DESC')
      .take(limit + 1);

    if (status) {
      qb.andWhere('sub.status = :status', { status });
    }

    if (cursorId) {
      qb.andWhere('sub.id > :cursorId', { cursorId });
    }

    return qb.getMany();
  }
}

