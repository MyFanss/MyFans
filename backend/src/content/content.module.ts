import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { ContentMetadata } from './entities/content.entity';
import { IpfsService } from './ipfs.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([ContentMetadata])],
  controllers: [ContentController],
  providers: [ContentService, IpfsService],
  exports: [ContentService],
})
export class ContentModule {}
