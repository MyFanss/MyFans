import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth-module/decorators/current-user.decorator';
import type { JwtUserPayload } from '../auth-module/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth-module/guards/optional-jwt-auth.guard';
import { PaginatedResponseDto, PaginationDto } from '../common/dto';
import {
  ContentAccessService,
  GatedContentView,
} from './content-access.service';
import { ContentService } from './content.service';
import {
  ContentResponseDto,
  CreateContentDto,
  UpdateContentDto,
} from './dto/content.dto';
import { ContentMetadata } from './entities/content.entity';

@ApiTags('content')
@Controller({ path: 'content', version: '1' })
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly contentAccessService: ContentAccessService,
  ) {}

  @Post()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'Makes retries safe; reusing a key with another body returns 409',
  })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create content metadata' })
  @ApiResponse({ status: 201, type: ContentResponseDto })
  create(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: CreateContentDto,
  ): Promise<ContentMetadata> {
    return this.contentService.create(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all content (paginated)' })
  @ApiResponse({ status: 200 })
  findAll(
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<ContentMetadata>> {
    return this.contentService.findAll(pagination);
  }

  @Get('creator/:creatorId')
  @ApiOperation({ summary: 'List content by creator (paginated)' })
  @ApiResponse({ status: 200 })
  findByCreator(
    @Param('creatorId', ParseUUIDPipe) creatorId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<ContentMetadata>> {
    return this.contentService.findByCreator(creatorId, pagination);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary:
      'Get content by ID — gated content returns a teaser to non-subscribers',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUserPayload,
  ): Promise<GatedContentView> {
    return this.contentAccessService.getForRequester(id, user?.userId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update content metadata (owner only)' })
  @ApiResponse({ status: 200, type: ContentResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden – not the owner' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: UpdateContentDto,
  ): Promise<ContentMetadata> {
    return this.contentService.update(id, user.userId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete content metadata (owner only)' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 403, description: 'Forbidden – not the owner' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUserPayload,
  ): Promise<void> {
    return this.contentService.remove(id, user.userId);
  }
}
