import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto';
import { GameStatus } from '../entities/game.entity';

export class ListGamesDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by game status',
    enum: GameStatus,
  })
  @IsOptional()
  @IsEnum(GameStatus)
  status?: GameStatus;
}
