import { IsBoolean, IsEnum, IsInt, IsISO8601, IsOptional, IsString, Min } from 'class-validator';
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

  @IsOptional()
  @IsInt()
  @Min(1)
  digest_count?: number;

  @IsOptional()
  @IsISO8601({}, { each: true })
  digest_event_times?: string[];
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
