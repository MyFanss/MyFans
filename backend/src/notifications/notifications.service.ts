import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto, MarkReadDto } from './dto/notification.dto';
import { NotificationType } from './entities/notification.entity';

export interface SubscriptionLifecycleNotificationRequest {
  dedupeKey: string;
  event: 'renewed' | 'cancelled';
  recipientUserId: string;
  creatorUserId: string;
  creatorDisplayName?: string;
  subscriptionId: string;
  planId: number;
  occurredAt?: Date;
  emailEnabled?: boolean;
}

export interface NotificationTemplate {
  inApp: {
    title: string;
    body: string;
  };
  email: {
    subject: string;
    body: string;
  };
}

interface NotificationQueueJob {
  dedupeKey: string;
  payload: SubscriptionLifecycleNotificationRequest;
  attempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  lastError?: string;
}

@Injectable()
export class NotificationsService {
  private readonly maxQueueAttempts = 3;
  private readonly retryQueue = new Map<string, NotificationQueueJob>();
  private readonly completedNotifications = new Map<string, Notification>();
  private readonly sentEmails: Array<{
    dedupeKey: string;
    toUserId: string;
    subject: string;
    body: string;
  }> = [];

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
  ) {}

  async findAllForUser(
    userId: string,
    unreadOnly = false,
  ): Promise<Notification[]> {
    const where: Record<string, unknown> = { user_id: userId };
    if (unreadOnly) where.is_read = false;
    return this.notificationsRepository.find({
      where,
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationsRepository.findOne({
      where: { id, user_id: userId },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }

  async create(dto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationsRepository.create(dto);
    return this.notificationsRepository.save(notification);
  }

  buildSubscriptionLifecycleTemplate(
    request: SubscriptionLifecycleNotificationRequest,
  ): NotificationTemplate {
    const creatorName = request.creatorDisplayName ?? request.creatorUserId;
    const occurredAt = (request.occurredAt ?? new Date()).toISOString();

    if (request.event === 'renewed') {
      return {
        inApp: {
          title: 'Subscription renewed',
          body: `Your subscription to ${creatorName} was renewed successfully.`,
        },
        email: {
          subject: `Your ${creatorName} subscription renewed`,
          body: `Your subscription renewal for ${creatorName} was processed successfully on ${occurredAt}.`,
        },
      };
    }

    return {
      inApp: {
        title: 'Subscription cancelled',
        body: `Your subscription to ${creatorName} has been cancelled.`,
      },
      email: {
        subject: `Your ${creatorName} subscription was cancelled`,
        body: `Your subscription cancellation for ${creatorName} was recorded on ${occurredAt}.`,
      },
    };
  }

  async enqueueSubscriptionLifecycleNotification(
    request: SubscriptionLifecycleNotificationRequest,
  ): Promise<Notification | null> {
    const existing = this.completedNotifications.get(request.dedupeKey);
    if (existing) {
      return existing;
    }

    const queued = this.retryQueue.get(request.dedupeKey);
    if (queued && queued.status !== 'failed') {
      return null;
    }

    this.retryQueue.set(request.dedupeKey, {
      dedupeKey: request.dedupeKey,
      payload: request,
      attempts: 0,
      status: 'pending',
    });

    return this.processQueueJob(request.dedupeKey);
  }

  async processRetryQueue(): Promise<void> {
    for (const [dedupeKey, job] of this.retryQueue.entries()) {
      if (job.status === 'pending') {
        await this.processQueueJob(dedupeKey);
      }
    }
  }

  getRetryQueueSnapshot(): NotificationQueueJob[] {
    return Array.from(this.retryQueue.values()).map((job) => ({ ...job }));
  }

  getSentEmails() {
    return [...this.sentEmails];
  }

  async markRead(id: string, userId: string, dto: MarkReadDto): Promise<Notification> {
    const notification = await this.findOne(id, userId);
    notification.is_read = dto.is_read;
    return this.notificationsRepository.save(notification);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationsRepository.update(
      { user_id: userId, is_read: false },
      { is_read: true },
    );
    return { updated: result.affected ?? 0 };
  }

  async remove(id: string, userId: string): Promise<void> {
    const notification = await this.findOne(id, userId);
    await this.notificationsRepository.remove(notification);
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.notificationsRepository.count({
      where: { user_id: userId, is_read: false },
    });
    return { count };
  }

  private async processQueueJob(dedupeKey: string): Promise<Notification | null> {
    const job = this.retryQueue.get(dedupeKey);
    if (!job || job.status === 'processing') {
      return null;
    }

    const existing = this.completedNotifications.get(dedupeKey);
    if (existing) {
      return existing;
    }

    const template = this.buildSubscriptionLifecycleTemplate(job.payload);
    const type =
      job.payload.event === 'renewed'
        ? NotificationType.SUBSCRIPTION_RENEWED
        : NotificationType.SUBSCRIPTION_CANCELLED;

    job.status = 'processing';
    job.attempts += 1;

    try {
      const notification = await this.create({
        user_id: job.payload.recipientUserId,
        type,
        title: template.inApp.title,
        body: template.inApp.body,
        metadata: {
          creatorUserId: job.payload.creatorUserId,
          subscriptionId: job.payload.subscriptionId,
          planId: job.payload.planId,
          lifecycleEvent: job.payload.event,
          dedupeKey,
        },
      });

      if (job.payload.emailEnabled !== false) {
        this.sentEmails.push({
          dedupeKey,
          toUserId: job.payload.recipientUserId,
          subject: template.email.subject,
          body: template.email.body,
        });
      }

      job.status = 'completed';
      this.completedNotifications.set(dedupeKey, notification);
      return notification;
    } catch (error) {
      job.lastError = error instanceof Error ? error.message : String(error);
      job.status =
        job.attempts >= this.maxQueueAttempts ? 'failed' : 'pending';
      return null;
    }
  }
}
