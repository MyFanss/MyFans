import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'The refresh token issued at login or previous refresh' })
  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}

export class LogoutDto {
  @ApiProperty({ description: 'The refresh token to invalidate' })
  @IsString()
  @IsNotEmpty()
  refresh_token: string;

  @ApiPropertyOptional({ description: 'If true, invalidates all sessions for the user' })
  @IsBoolean()
  @IsOptional()
  all_devices?: boolean;
}

export class TokenResponseDto {
  @ApiProperty()
  access_token: string;

  @ApiProperty()
  refresh_token: string;

  @ApiProperty()
  token_type: string;

  @ApiProperty()
  expires_in: number;
}
