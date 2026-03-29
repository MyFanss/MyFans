import { Controller, Post, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { GamesService } from './games.service';
import { JoinGameDto } from './dto/join-game.dto';

@ApiTags('games')
@Controller({ path: 'games', version: '1' })
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Post(':id/join')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Join a game' })
  @ApiParam({ name: 'id', description: 'Game ID' })
  @ApiResponse({ status: 201, description: 'Successfully joined the game' })
  @ApiResponse({ status: 404, description: 'Game not found' })
  async joinGame(@Param('id') id: string, @Body() joinGameDto: JoinGameDto) {
    return await this.gamesService.joinGame(id, joinGameDto.userId);
  }
}
