import { ApiProperty } from '@nestjs/swagger';

export class PlanDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  creator: string;

  @ApiProperty()
  asset: string;

  @ApiProperty()
  amount: string;

  @ApiProperty()
  intervalDays: number;
}
