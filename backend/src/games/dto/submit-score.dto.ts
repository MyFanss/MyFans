import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class SubmitScoreDto {
  @ApiProperty({ description: "Player's current/final balance for the game" })
  @IsNumber()
  @Min(0)
  balance: number;
}
