import { ApiProperty } from '@nestjs/swagger';

export class ActiveSubscriptionItemDto {
  @ApiProperty() id: string;
  @ApiProperty() creatorId: string;
  @ApiProperty() creatorName: string;
  @ApiProperty() planName: string;
  @ApiProperty() price: number;
  @ApiProperty() currency: string;
  @ApiProperty() interval: string;
  @ApiProperty() renewsAt: string;
  @ApiProperty() renewsAtUnix: number;
  @ApiProperty() status: string;
  @ApiProperty() createdAt: string;
}

export class FanDashboardSummaryDto {
  @ApiProperty() fan: string;
  @ApiProperty() totalActive: number;
  @ApiProperty({ type: [ActiveSubscriptionItemDto] })
  subscriptions: ActiveSubscriptionItemDto[];
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}
