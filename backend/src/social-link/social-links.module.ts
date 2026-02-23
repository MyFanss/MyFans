import { Module } from '@nestjs/common';
import { SocialLinksService } from './social-links.service';

@Module({
  providers: [SocialLinksService],
  exports: [SocialLinksService],
})
export class SocialLinksModule {}
