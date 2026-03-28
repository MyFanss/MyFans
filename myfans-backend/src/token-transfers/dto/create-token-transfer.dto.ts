import { IsString, IsDecimal, IsUUID, IsOptional } from 'class-validator';
import { TransferDirection } from '../entities/token-transfer.entity';

export class CreateTokenTransferDto {
  @IsString()
  sender_address!: string;

  @IsString()
  receiver_address!: string;

  @IsString()
  account_address!: string;

  @IsDecimal({ decimal_digits: '0,6' })
  amount!: string;

  @IsString()
  direction!: TransferDirection;

  @IsString()
  tx_hash!: string;

  @IsString()
  @IsOptional()
  token_type?: string;

  @IsString()
  @IsOptional()
  contract_address?: string;

  @IsDecimal({ decimal_digits: '0,6' })
  @IsOptional()
  fee?: string;

  @IsDecimal({ decimal_digits: '0,6' })
  @IsOptional()
  net_amount?: string;

  @IsUUID()
  @IsOptional()
  user_id?: string;
}
