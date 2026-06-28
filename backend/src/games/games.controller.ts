import { Controller, Get, Post, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { GamesService } from './games.service';
import { JoinGameDto } from './dto/join-game.dto';
import { ListGamesDto } from './dto/list-games.dto';

@ApiTags('games')
@Controller({ path: 'games', version: '1' })
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get()
  @ApiOperation({ summary: 'List games with pagination' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (1-100)' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by game status' })
  @ApiResponse({ status: 200, description: 'Paginated list of games' })
  async findAll(@Query() listGamesDto: ListGamesDto) {
    return await this.gamesService.findAll(listGamesDto);
  }

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
