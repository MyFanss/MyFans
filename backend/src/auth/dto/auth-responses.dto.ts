import { ApiProperty } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty({ description: 'Stellar address used as the user identifier' })
  userId: string;

  @ApiProperty({ description: 'Opaque session token' })
  token: string;
}

export class ChallengeResponseDto {
  @ApiProperty({ description: 'One-time nonce the wallet must sign' })
  nonce: string;

  @ApiProperty({ description: 'UTC datetime when this challenge expires (5 minutes from issuance)' })
  expiresAt: Date;
}

export class TokenResponseDto {
  @ApiProperty({ description: 'Signed JWT for use in Authorization: Bearer <token> headers' })
  access_token: string;

  @ApiProperty({ description: 'Token scheme', example: 'Bearer' })
  token_type: string;
}

export class AuthErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: 'BAD_REQUEST', description: 'Screaming-snake error code' })
  error: string;

  @ApiProperty({ example: 'Invalid Stellar address' })
  message: string;

  @ApiProperty({ example: '2026-06-29T10:00:00.000Z', description: 'ISO 8601 timestamp' })
  timestamp: string;

  @ApiProperty({ example: '/v1/auth/login' })
  path: string;
}
