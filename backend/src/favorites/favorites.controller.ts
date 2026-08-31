import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';
import { CurrentUser } from '../auth-module/decorators/current-user.decorator';

/**
 * FavoritesController
 *
 * CRUD for a fan's favorited creators. Matches the frontend contract in
 * `frontend/src/lib/favorites.ts`: GET returns an array of creator IDs,
 * POST/DELETE take the creator ID as a path param.
 *
 * @Controller favorites
 * @version 1
 * @tags favorites
 * @security BearerAuth
 */
@ApiTags('favorites')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@ApiBearerAuth()
@Controller({ path: 'favorites', version: '1' })
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's favorited creator IDs" })
  @ApiResponse({
    status: 200,
    description: 'Array of favorited creator IDs',
    schema: { example: ['creator-1', 'creator-2'] },
  })
  async findAll(
    @CurrentUser() user: { userId: string },
  ): Promise<string[]> {
    return this.favoritesService.listFavoriteCreatorIds(user.userId);
  }

  @Post(':creatorId')
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Favorite a creator' })
  @ApiParam({ name: 'creatorId', description: 'Creator (user) ID' })
  @ApiResponse({
    status: 201,
    description: 'Favorite added successfully',
    schema: { example: { creatorId: 'uuid', favorited: true } },
  })
  @ApiResponse({
    status: 200,
    description: 'Creator already favorited (idempotent)',
    schema: { example: { creatorId: 'uuid', favorited: true } },
  })
  @ApiResponse({
    status: 404,
    description: 'Creator not found',
    schema: { example: { statusCode: 404, message: 'Creator with id "id" not found' } },
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests',
    schema: { example: { statusCode: 429, message: 'Too Many Requests' } },
  })
  async addFavorite(
    @Param('creatorId') creatorId: string,
    @CurrentUser() user: { userId: string },
  ) {
    await this.favoritesService.addFavorite(user.userId, creatorId);
    return { creatorId, favorited: true };
  }

  @Delete(':creatorId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Unfavorite a creator' })
  @ApiParam({ name: 'creatorId', description: 'Creator (user) ID' })
  @ApiResponse({ status: 204, description: 'Favorite removed successfully' })
  @ApiResponse({
    status: 404,
    description: 'Favorite not found',
    schema: { example: { statusCode: 404, message: 'Favorite not found' } },
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests',
    schema: { example: { statusCode: 429, message: 'Too Many Requests' } },
  })
  async removeFavorite(
    @Param('creatorId') creatorId: string,
    @CurrentUser() user: { userId: string },
  ): Promise<void> {
    await this.favoritesService.removeFavorite(user.userId, creatorId);
  }
}
