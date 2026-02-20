import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsOptional, IsString, IsUrl, Matches } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {
  @IsOptional()
  @IsString()
  @IsUrl()
  avatar_url?: string;

  @IsOptional()
  @IsString()
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'Invalid Stellar address format',
  })
  wallet_address?: string;
}
