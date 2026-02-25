import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from './entities/comment.entity';
import { Post } from '../posts/entities/post.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Comment, Post, Subscription]), AuthModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule { }
