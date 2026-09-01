import 'reflect-metadata';
import { DataSource } from 'typeorm';

// ── Migration files (ordered by timestamp) ───────────────────────────────────
import { CreateRefreshTokens1700000000000 } from './database/migrations/1700000000000-CreateRefreshTokens';
import { AddSocialLinksToUser1700000000000 } from './social-link/1700000000000-AddSocialLinksToUser';
import { CreateWalletChallenges1711554834000 } from './database/migrations/1711554834000-CreateWalletChallenges';
import { CreateIdempotencyKeys1711554835000 } from './idempotency/1711554835000-CreateIdempotencyKeys';
import { AddQueuedAtToModerationFlags1745000000000 } from './moderation/1745000000000-AddQueuedAtToModerationFlags';
import { CreateReferralTables1745000000000 } from './referral/1745000000000-CreateReferralTables';
import { AddReferralAttribution1745500000000 } from './referral/1745500000000-AddReferralAttribution';
import { AddDigestColumnsToNotifications1745100000000 } from './notifications/1745100000000-AddDigestColumnsToNotifications';
import { AddOnboardingStateToUsers1745200000000 } from './users/1745200000000-AddOnboardingStateToUsers';
import { AddRoleToUsers1747000000000 } from './users/1747000000000-AddRoleToUsers';
import { CreateSocialLinksTable1748000000000 } from './social-link/1748000000000-CreateSocialLinksTable';
import { CreateCreatorOnchainMappings1749000000000 } from './creators/1749000000000-CreateCreatorOnchainMappings';
import { CreateNotificationDurableState1750000000000 } from './notifications/1750000000000-CreateNotificationDurableState';
import { CreateUserWalletLinks1751000000000 } from './auth-module/1751000000000-CreateUserWalletLinks';

// ── Feature module entities (all canonically wired or transitively available) ─
import { User } from './users/entities/user.entity';
import { Creator } from './users/entities/creator.entity';
import { RefreshToken } from './refresh-module/refresh-token.entity';
import { SocialLink } from './social-link/social-link.entity';
import { WalletChallenge } from './auth/wallet-challenge.entity';
import { IdempotencyKey } from './idempotency/idempotency-key.entity';
import { ModerationFlag } from './moderation/entities/moderation-flag.entity';
import { ModerationAuditLog } from './moderation/entities/moderation-audit-log.entity';
import { ReferralCode } from './referral/entities/referral-code.entity';
import { ReferralRedemption } from './referral/entities/referral-redemption.entity';
import { ReferralReward } from './referral/entities/referral-reward.entity';
import { Notification } from './notifications/entities/notification.entity';
import { EmailOutboxEntry } from './notifications/entities/email-outbox-entry.entity';
import { NotificationRetryJobEntity } from './notifications/entities/notification-retry-job.entity';
import { NotificationDigestWindowEntity } from './notifications/entities/notification-digest-window.entity';
import { SubscriptionIndexEntity } from './subscriptions/entities/subscription-index.entity';
import { FanSpendingCapEntity } from './subscriptions/entities/fan-spending-cap.entity';
import { Post } from './posts/entities/post.entity';
import { PostAuditLog } from './posts/entities/post-audit-log.entity';
import { Like } from './likes/entities/like.entity';
import { Favorite } from './favorites/entities/favorite.entity';
import { Comment } from './comments/entities/comment.entity';
import { CommentAuditLog } from './comments/entities/comment-audit-log.entity';
import { Conversation } from './conversations/entities/conversation.entity';
import { Message } from './conversations/entities/message.entity';
import { Game } from './games/entities/game.entity';
import { Player } from './games/entities/player.entity';
import { ContentMetadata } from './content/entities/content.entity';
import { WebhookAuditLog } from './webhook/entities/webhook-audit-log.entity';
import { WebhookProcessedEvent } from './webhook/entities/webhook-processed-event.entity';
import { CreatorOnchainMapping } from './creators/entities/creator-onchain-mapping.entity';
import { UserWalletLink } from './auth-module/entities/user-wallet-link.entity';

export const migrationDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'myfans',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'myfans',
  synchronize: false,
  logging: process.env.MIGRATION_LOG === 'true',
  migrations: [
    CreateRefreshTokens1700000000000,
    AddSocialLinksToUser1700000000000,
    CreateWalletChallenges1711554834000,
    CreateIdempotencyKeys1711554835000,
    AddQueuedAtToModerationFlags1745000000000,
    CreateReferralTables1745000000000,
    AddDigestColumnsToNotifications1745100000000,
    AddOnboardingStateToUsers1745200000000,
    AddReferralAttribution1745500000000,
    AddRoleToUsers1747000000000,
    CreateSocialLinksTable1748000000000,
    CreateCreatorOnchainMappings1749000000000,
    CreateNotificationDurableState1750000000000,
    CreateUserWalletLinks1751000000000,
  ],
  entities: [
    User,
    Creator,
    RefreshToken,
    SocialLink,
    WalletChallenge,
    IdempotencyKey,
    ModerationFlag,
    ModerationAuditLog,
    ReferralCode,
    ReferralRedemption,
    ReferralReward,
    Notification,
    EmailOutboxEntry,
    NotificationRetryJobEntity,
    NotificationDigestWindowEntity,
    SubscriptionIndexEntity,
    FanSpendingCapEntity,
    Post,
    PostAuditLog,
    Like,
    Favorite,
    Comment,
    CommentAuditLog,
    Conversation,
    Message,
    Game,
    Player,
    ContentMetadata,
    WebhookAuditLog,
    WebhookProcessedEvent,
    CreatorOnchainMapping,
    UserWalletLink,
  ],
});
