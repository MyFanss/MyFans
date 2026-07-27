import {
  Body,
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
import { SubmitScoreDto } from './dto/submit-score.dto';
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

  /**
   * As with join, the actor is always the authenticated JWT subject —
   * never a caller-supplied body field.
   */
  @Post(':id/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start a game (host only)' })
  @ApiParam({ name: 'id', description: 'Game ID' })
  @ApiResponse({ status: 201, description: 'Game started' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only the host can start the game' })
  @ApiResponse({ status: 404, description: 'Game not found' })
  @ApiResponse({ status: 400, description: 'Game is not in a startable state' })
  async startGame(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    return await this.gamesService.startGame(id, user.userId);
  }

  @Post(':id/leave')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Leave a game as the authenticated user' })
  @ApiParam({ name: 'id', description: 'Game ID' })
  @ApiResponse({ status: 200, description: 'Successfully left the game' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Game or player not found' })
  @ApiResponse({ status: 400, description: 'Cannot leave a completed game' })
  async leaveGame(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
  ) {
    return await this.gamesService.leaveGame(id, user.userId);
  }

  @Post(':id/score')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Submit the authenticated player's current/final score" })
  @ApiParam({ name: 'id', description: 'Game ID' })
  @ApiResponse({ status: 201, description: 'Score recorded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Game or player not found' })
  @ApiResponse({ status: 400, description: 'Game is not in progress' })
  async submitScore(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: SubmitScoreDto,
  ) {
    return await this.gamesService.submitScore(id, user.userId, dto);
  }
}
