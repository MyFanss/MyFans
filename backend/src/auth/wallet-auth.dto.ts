import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestChallengeDto {
  @ApiProperty({ description: 'Stellar public key (G-strkey, 56 chars)' })
  @IsString()
  @Length(56, 56)
  address: string;
}

export class VerifyChallengeDto {
  @ApiProperty({ description: 'Stellar public key (G-strkey, 56 chars)' })
  @IsString()
  @Length(56, 56)
  address: string;

  @ApiProperty({ description: 'Nonce received from /auth/challenge' })
  @IsString()
  nonce: string;

  @ApiProperty({ description: 'Hex-encoded Ed25519 signature of the nonce' })
  @IsString()
  signature: string;
}
