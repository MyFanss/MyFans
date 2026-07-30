import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ContentController } from './content.controller';
import { ContentAccessService } from './content-access.service';
import { ContentService } from './content.service';
import { ContentMetadata } from './entities/content.entity';
import { IpfsService } from './ipfs.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ContentMetadata]),
    SubscriptionsModule,
  ],
  controllers: [ContentController],
  providers: [ContentService, IpfsService, ContentAccessService],
  exports: [ContentService],
})
export class ContentModule {}
