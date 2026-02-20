import { IsOptional, IsUUID } from 'class-validator';

export class SubscribeDto {
  @IsUUID()
  creator_id!: string;

  @IsOptional()
  @IsUUID()
  plan_id?: string;
}
