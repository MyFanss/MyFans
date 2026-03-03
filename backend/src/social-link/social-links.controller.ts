import { Controller, Post, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { SocialLinksService } from './social-links.service';
import { SocialLinksDto } from './social-links.dto';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'; // ✅ import ThrottlerGuard

@UseGuards(ThrottlerGuard) // ✅ add this
@Controller('social-links')
export class SocialLinkController {
  constructor(private readonly socialLinksService: SocialLinksService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60 } })
  create(@Body() socialLinksDto: SocialLinksDto) {
    return this.socialLinksService.extractUpdatePayload(socialLinksDto);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 5, ttl: 60 } })
  update(@Param('id') id: string, @Body() socialLinksDto: SocialLinksDto) {
    return this.socialLinksService.extractUpdatePayload(socialLinksDto);
  }
}