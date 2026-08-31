import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationDigestWindowEntity } from './entities/notification-digest-window.entity';

export interface DigestWindowRecord {
  key: string;
  notificationId: string;
  eventTimes: string[];
  /** Epoch ms after which this window is considered expired. */
  windowExpiresAt: number;
}

/** Durable backing store for open digest windows. */
@Injectable()
export class NotificationDigestStoreService {
  constructor(
    @InjectRepository(NotificationDigestWindowEntity)
    private readonly repo: Repository<NotificationDigestWindowEntity>,
  ) {}

  async get(key: string): Promise<DigestWindowRecord | null> {
    const row = await this.repo.findOne({ where: { digest_key: key } });
    return row ? this.toRecord(row) : null;
  }

  async set(record: DigestWindowRecord): Promise<void> {
    const entity = this.repo.create({
      digest_key: record.key,
      notification_id: record.notificationId,
      event_times: record.eventTimes,
      window_expires_at: record.windowExpiresAt,
    });
    await this.repo.save(entity);
  }

  async delete(key: string): Promise<void> {
    await this.repo.delete({ digest_key: key });
  }

  async listAll(): Promise<DigestWindowRecord[]> {
    const rows = await this.repo.find();
    return rows.map((row) => this.toRecord(row));
  }

  private toRecord(row: NotificationDigestWindowEntity): DigestWindowRecord {
    return {
      key: row.digest_key,
      notificationId: row.notification_id,
      eventTimes: row.event_times,
      windowExpiresAt: Number(row.window_expires_at),
    };
  }
}
