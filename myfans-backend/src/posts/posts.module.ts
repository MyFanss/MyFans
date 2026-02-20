import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './entities/post.entity';
import { Creator } from '../creators/entities/creator.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';

import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [TypeOrmModule.forFeature([Post, Creator, Subscription])],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService, TypeOrmModule],
})
export class PostsModule {}
