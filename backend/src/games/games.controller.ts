import { Controller, Post, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { GamesService } from './games.service';
import { JoinGameDto } from './dto/join-game.dto';

@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Post(':id/join')
  @HttpCode(HttpStatus.CREATED)
  async joinGame(@Param('id') id: string, @Body() joinGameDto: JoinGameDto) {
    return await this.gamesService.joinGame(id, joinGameDto.userId);
  }
}
