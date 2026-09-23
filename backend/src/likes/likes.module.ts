import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LikesController } from './likes.controller';
import { LikesService } from './likes.service';
import { Like } from './entities/like.entity';
import { PostsModule } from '../posts/posts.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

/**
 * Single source of truth for content likes (ADR #1749, Option A: DB-only).
 *
 * The database is the sole writer/ledger for likes. The on-chain like path is
 * deprecated and must not be wired as a second writer; any historical chain
 * events are treated as read-only and reconciled into the DB idempotently by
 * LikesService (unique like per user+post). No dual-write path is enabled in
 * production flags.
 */
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
