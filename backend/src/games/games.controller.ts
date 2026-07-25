import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { GamesService } from './games.service';
import { ListGamesDto } from './dto/list-games.dto';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';
import { CurrentUser } from '../auth-module/decorators/current-user.decorator';

@ApiTags('games')
@Controller({ path: 'games', version: '1' })
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get()
  @ApiOperation({ summary: 'List games with pagination' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (1-based)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (1-100)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by game status',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of games' })
  async findAll(@Query() listGamesDto: ListGamesDto) {
    return await this.gamesService.findAll(listGamesDto);
  }

  /**
   * The joining player is always the authenticated JWT subject, never a
   * caller-supplied body field — otherwise any caller could join a game as
   * an arbitrary user.
   */
  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Join a game as the authenticated user' })
  @ApiParam({ name: 'id', description: 'Game ID' })
  @ApiResponse({ status: 201, description: 'Successfully joined the game' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Game not found' })
  async joinGame(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    return await this.gamesService.joinGame(id, user.userId);
  }
}
