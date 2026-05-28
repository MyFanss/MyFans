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
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth-module/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';
import { PaginatedResponseDto, PaginationDto } from '../common/dto';
import { ContentService } from './content.service';
import { ContentResponseDto, CreateContentDto, UpdateContentDto } from './dto/content.dto';
import { ContentMetadata } from './entities/content.entity';

@ApiTags('content')
@Controller({ path: 'content', version: '1' })
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create content metadata' })
  @ApiResponse({ status: 201, type: ContentResponseDto })
  create(
    @CurrentUser() user: { userId: string },
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
  @ApiOperation({ summary: 'Get content by ID' })
  @ApiResponse({ status: 200, type: ContentResponseDto })
  @ApiResponse({ status: 404 })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ContentMetadata> {
    return this.contentService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update content metadata (owner only)' })
  @ApiResponse({ status: 200, type: ContentResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden – not the owner' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { userId: string },
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
    @CurrentUser() user: { userId: string },
  ): Promise<void> {
    return this.contentService.remove(id, user.userId);
  }
}
