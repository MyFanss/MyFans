import { IsOptional, IsEnum } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto';
import { SubscriptionStatus } from '../entities/subscription.entity';

export class ListSubscriptionsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;
}
