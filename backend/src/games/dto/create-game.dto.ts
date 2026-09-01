import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class CreateGameDto {
  @IsInt()
  @Min(2)
  @Max(20)
  numberOfPlayers: number;

  @IsNumber()
  @Min(1)
  startingCash: number;

  @IsOptional()
  @IsBoolean()
  randomizeTurnOrder = false;
}
