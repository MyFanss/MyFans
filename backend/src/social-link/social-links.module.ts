import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialLinksService } from './social-links.service';
import { SocialLinkController } from './social-links.controller';
import { SocialLink } from './social-link.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SocialLink])],
  controllers: [SocialLinkController],
  providers: [SocialLinksService],
  exports: [SocialLinksService],
})
export class SocialLinksModule {}
