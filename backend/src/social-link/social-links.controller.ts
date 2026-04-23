import { Controller, Post, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { SocialLinksService } from './social-links.service';
import { SocialLinksDto } from './social-links.dto';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

@ApiTags('social-links')
@UseGuards(ThrottlerGuard)
@Controller({ path: 'social-links', version: '1' })
export class SocialLinkController {
  constructor(private readonly socialLinksService: SocialLinksService) { }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Create social links for a user' })
  @ApiResponse({ status: 201, description: 'Social links created' })
  create(@Body() socialLinksDto: SocialLinksDto) {
    return this.socialLinksService.extractUpdatePayload(socialLinksDto);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Update social links for a user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Social links updated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  update(@Param('id') id: string, @Body() socialLinksDto: SocialLinksDto) {
    return this.socialLinksService.extractUpdatePayload(socialLinksDto);
  }
}