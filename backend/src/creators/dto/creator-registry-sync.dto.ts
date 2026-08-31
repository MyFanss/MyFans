import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreatorRegistrySyncDto {
  @ApiProperty({
    description: 'Stellar G-address the creator registered on-chain with',
    example: 'GAB6...',
  })
  @IsNotEmpty()
  @IsString()
  @Length(56, 56)
  stellarAddress: string;

  @ApiProperty({
    description:
      "creator_id returned by the creator-registry contract's register_creator/get_creator_id (u64, as a string)",
    example: '456',
  })
  @IsNotEmpty()
  @IsString()
  onchainCreatorId: string;
}
