import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto, MarkReadDto } from './dto/notification.dto';

@Injectable()
export class NotificationsService {
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
}
