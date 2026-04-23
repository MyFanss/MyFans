import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto';
import { SubscriptionStatus } from '../subscriptions.service';

export class ListSubscriptionsQueryDto extends PaginationDto {
  @IsString()
  @IsNotEmpty()
  fan: string;

  @IsOptional()
  @IsEnum(SubscriptionStatus, {
    message: `status must be one of: ${Object.values(SubscriptionStatus).join(', ')}`,
  })
  status?: SubscriptionStatus;

  @IsOptional()
  @IsString()
  sort?: string;
}
