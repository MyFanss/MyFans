import { Module } from '@nestjs/common';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { PostsModule } from '../posts/posts.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [PostsModule, SubscriptionsModule],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}
