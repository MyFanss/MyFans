import { Module } from '@nestjs/common';
import { SocialLinksService } from './social-links.service';
import { SocialLinkController } from './social-links.controller';

@Module({
  controllers: [SocialLinkController],
  providers: [SocialLinksService],
  exports: [SocialLinksService],
})
export class SocialLinksModule {}
