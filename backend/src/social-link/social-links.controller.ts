import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { SocialLinksService } from './social-links.service';
import { SocialLinksDto } from './social-links.dto';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';
import { SocialLinksResponseDto, SocialLinksListItemDto } from './user-profile.dto';

@ApiTags('social-links')
@ApiExtraModels(PaginatedResponseDto, SocialLinksListItemDto)
@UseGuards(ThrottlerGuard)
@Controller({ path: 'social-links', version: '1' })
export class SocialLinkController {
  constructor(private readonly socialLinksService: SocialLinksService) {}

  @Get()
  @ApiOperation({ summary: 'List social links with pagination' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number (default 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
    description: 'Number of items per page (default 20, max 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated social links list',
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(SocialLinksListItemDto) },
            },
          },
        },
      ],
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid pagination parameters' })
  list(@Query() pagination: PaginationDto) {
    return this.socialLinksService.listSocialLinks(pagination);
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Create social links for a user' })
  @ApiBody({ type: SocialLinksDto })
  @ApiResponse({
    status: 201,
    description: 'Social links created',
    type: SocialLinksResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation error – invalid URL, scheme, handle format, or disallowed domain',
  })
  @ApiResponse({ status: 429, description: 'Too many requests (5 per minute)' })
  create(@Body() socialLinksDto: SocialLinksDto) {
    return this.socialLinksService.createSocialLinks(socialLinksDto);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Update social links for a user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: SocialLinksDto })
  @ApiResponse({
    status: 200,
    description: 'Social links updated',
    type: SocialLinksResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation error – invalid URL, scheme, handle format, or disallowed domain',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 429, description: 'Too many requests (5 per minute)' })
  update(@Param('id') id: string, @Body() socialLinksDto: SocialLinksDto) {
    return this.socialLinksService.updateSocialLinks(id, socialLinksDto);
  }
}
