import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { PaymentStatus, PaymentType } from '../entities/payment.entity';

export class CreatePaymentDto {
  @IsUUID()
  user_id!: string;

  @IsUUID()
  creator_id!: string;

  @IsNumber()
  @Min(0.000001)
  amount!: number;

  @IsString()
  currency!: string;

  @IsEnum(PaymentStatus)
  status!: PaymentStatus;

  @IsEnum(PaymentType)
  type!: PaymentType;

  @IsOptional()
  @IsString()
  reference_id?: string;

  @IsOptional()
  @IsString()
  tx_hash?: string;
}
