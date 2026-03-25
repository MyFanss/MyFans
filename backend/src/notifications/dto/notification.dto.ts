import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { NotificationType } from '../entities/notification.entity';

export class CreateNotificationDto {
  @IsString()
  user_id: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class MarkReadDto {
  @IsBoolean()
  is_read: boolean;
}

export class NotificationQueryDto {
  @IsOptional()
  @IsBoolean()
  unread_only?: boolean;
}
