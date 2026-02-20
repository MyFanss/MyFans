import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsOptional, IsString, IsUrl } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {
  @IsOptional()
  @IsString()
  @IsUrl()
  avatar_url?: string;
}
