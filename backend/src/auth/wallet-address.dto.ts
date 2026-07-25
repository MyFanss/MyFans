import { IsString } from 'class-validator';
import { IsStellarAddress } from '../common/utils/stellar-address';

export class WalletAddressDto {
  @IsString()
  @IsStellarAddress()
  address: string;
}
