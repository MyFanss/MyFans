import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { SocialLinksController } from './social-links.controller';
import { SocialLinksService } from './social-links.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'social-links-patch',
        ttl: 60_000,
        limit: 5,
      },
    ]),
  ],
  controllers: [SocialLinksController],
  providers: [SocialLinksService],
  exports: [SocialLinksService],
})
export class SocialLinksModule {}
