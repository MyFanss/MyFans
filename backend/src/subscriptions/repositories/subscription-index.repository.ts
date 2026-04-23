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
      // Idempotency: unique violation on (ledgerSeq, eventIndex) → ignore
      if (error instanceof Error && 'code' in error && error.code === '23505') {
        this.logger.warn(`Event already indexed: ledger ${data.ledgerSeq}:${data.eventIndex}`);
        // Fetch existing
        const existing = await this.findByEventId(data.ledgerSeq, data.eventIndex);
        if (!existing) throw error;
        return existing;
      }
      throw error;
    }
  }

  async upsertManual(data: UpsertManualData): Promise<SubscriptionIndexEntity> {
    // Upsert on (fan, creator) - keep latest
    const existing = await this.findCurrentForFanCreator(data.fan, data.creator);
    const entity = this.repo.create({
      ...data,
      ledgerSeq: -1, // manual
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

  async updateStatus(fan: string, creator: string, status: SubscriptionStatus, expiryUnix?: number): Promise<void> {
    await this.repo.update(
      { fan, creator, status: SubscriptionStatus.ACTIVE },
      { status, expiryUnix: expiryUnix ?? 0, updatedAt: new Date() },
    );
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
}

