import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LikesController } from './likes.controller';
import { LikesService } from './likes.service';
import { Like } from './entities/like.entity';
import { PostsModule } from '../posts/posts.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Like]),
    forwardRef(() => PostsModule),
    forwardRef(() => SubscriptionsModule),
  ],
  controllers: [LikesController],
  providers: [LikesService],
  exports: [LikesService, TypeOrmModule],
})
export class LikesModule {}
