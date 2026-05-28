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

/** Key used to group notifications into a digest window. */
type DigestKey = string; // `${userId}:${type}:${creatorUserId}`

interface DigestWindow {
  notificationId: string;
  eventTimes: string[];
  windowExpiresAt: number; // epoch ms
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

  /** Active digest windows keyed by DigestKey. */
  private readonly digestWindows = new Map<DigestKey, DigestWindow>();

  /** Digest window duration in milliseconds (default 5 minutes). */
  readonly digestWindowMs: number;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    digestWindowMs = 5 * 60 * 1000,
  ) {
    this.digestWindowMs = digestWindowMs;
  }

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
    const notification = this.notificationsRepository.create({
      ...dto,
      digest_count: dto.digest_count ?? 1,
      digest_event_times: dto.digest_event_times ?? null,
    });
    return this.notificationsRepository.save(notification);
  }

  buildSubscriptionLifecycleTemplate(
    request: SubscriptionLifecycleNotificationRequest,
    digestCount = 1,
  ): NotificationTemplate {
    const creatorName = request.creatorDisplayName ?? request.creatorUserId;
    const occurredAt = (request.occurredAt ?? new Date()).toISOString();

    if (request.event === 'renewed') {
      const title =
        digestCount > 1
          ? `${digestCount} subscriptions renewed`
          : 'Subscription renewed';
      const body =
        digestCount > 1
          ? `${digestCount} subscriptions to ${creatorName} were renewed.`
          : `Your subscription to ${creatorName} was renewed successfully.`;
      return {
        inApp: { title, body },
        email: {
          subject: `Your ${creatorName} subscription renewed`,
          body: `Your subscription renewal for ${creatorName} was processed successfully on ${occurredAt}.`,
        },
      };
    }

    const title =
      digestCount > 1
        ? `${digestCount} subscriptions cancelled`
        : 'Subscription cancelled';
    const body =
      digestCount > 1
        ? `${digestCount} subscriptions to ${creatorName} have been cancelled.`
        : `Your subscription to ${creatorName} has been cancelled.`;
    return {
      inApp: { title, body },
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

  // ── Digest helpers ──────────────────────────────────────────────────────

  private digestKeyFor(
    userId: string,
    type: NotificationType,
    creatorUserId: string,
  ): DigestKey {
    return `${userId}:${type}:${creatorUserId}`;
  }

  /**
   * Attempt to fold this event into an open digest window.
   * Returns the updated notification if folded, or null if a new one must be created.
   */
  async foldIntoDigest(
    userId: string,
    type: NotificationType,
    creatorUserId: string,
    eventTime: string,
  ): Promise<Notification | null> {
    const key = this.digestKeyFor(userId, type, creatorUserId);
    const window = this.digestWindows.get(key);

    if (!window || Date.now() > window.windowExpiresAt) {
      // No active window — caller must create a new notification
      return null;
    }

    // Window is still open — update the existing notification in-place
    const notification = await this.notificationsRepository.findOne({
      where: { id: window.notificationId },
    });
    if (!notification) {
      this.digestWindows.delete(key);
      return null;
    }

    window.eventTimes.push(eventTime);
    notification.digest_count = window.eventTimes.length;
    notification.digest_event_times = [...window.eventTimes];

    // Update title/body to reflect new count
    const countWord = notification.digest_count;
    if (type === NotificationType.SUBSCRIPTION_RENEWED) {
      notification.title = `${countWord} subscriptions renewed`;
      notification.body = `${countWord} subscription renewals have been processed.`;
    } else if (type === NotificationType.SUBSCRIPTION_CANCELLED) {
      notification.title = `${countWord} subscriptions cancelled`;
      notification.body = `${countWord} subscriptions have been cancelled.`;
    } else if (type === NotificationType.NEW_SUBSCRIBER) {
      notification.title = `${countWord} new subscribers`;
      notification.body = `You have ${countWord} new subscribers.`;
    }

    return this.notificationsRepository.save(notification);
  }

  /** Open a new digest window after creating the first notification. */
  openDigestWindow(
    userId: string,
    type: NotificationType,
    creatorUserId: string,
    notificationId: string,
    firstEventTime: string,
  ): void {
    const key = this.digestKeyFor(userId, type, creatorUserId);
    this.digestWindows.set(key, {
      notificationId,
      eventTimes: [firstEventTime],
      windowExpiresAt: Date.now() + this.digestWindowMs,
    });
  }

  // ── Private queue processing ────────────────────────────────────────────

  private async processQueueJob(dedupeKey: string): Promise<Notification | null> {
    const job = this.retryQueue.get(dedupeKey);
    if (!job || job.status === 'processing') {
      return null;
    }

    const existing = this.completedNotifications.get(dedupeKey);
    if (existing) {
      return existing;
    }

    const type =
      job.payload.event === 'renewed'
        ? NotificationType.SUBSCRIPTION_RENEWED
        : NotificationType.SUBSCRIPTION_CANCELLED;

    const eventTime = (job.payload.occurredAt ?? new Date()).toISOString();

    job.status = 'processing';
    job.attempts += 1;

    try {
      // Try to fold into an existing digest window first
      const folded = await this.foldIntoDigest(
        job.payload.recipientUserId,
        type,
        job.payload.creatorUserId,
        eventTime,
      );

      let notification: Notification;

      if (folded) {
        notification = folded;
      } else {
        const template = this.buildSubscriptionLifecycleTemplate(job.payload, 1);
        notification = await this.create({
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
          digest_count: 1,
          digest_event_times: [eventTime],
        });

        this.openDigestWindow(
          job.payload.recipientUserId,
          type,
          job.payload.creatorUserId,
          notification.id,
          eventTime,
        );
      }

      if (job.payload.emailEnabled !== false && !folded) {
        const template = this.buildSubscriptionLifecycleTemplate(job.payload, 1);
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
