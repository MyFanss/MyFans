import 'reflect-metadata';
import { DataSource } from 'typeorm';

// ── Migration files (ordered by timestamp) ───────────────────────────────────
import { CreateRefreshTokens1700000000000 } from './refresh-module/1700000000000-CreateRefreshTokens';
import { AddSocialLinksToUser1700000000000 } from './social-link/1700000000000-AddSocialLinksToUser';
import { CreateWalletChallenges1711554834000 } from './auth/1711554834000-CreateWalletChallenges';
import { CreateIdempotencyKeys1711554835000 } from './idempotency/1711554835000-CreateIdempotencyKeys';
import { AddQueuedAtToModerationFlags1745000000000 } from './moderation/1745000000000-AddQueuedAtToModerationFlags';
import { CreateReferralTables1745000000000 } from './referral/1745000000000-CreateReferralTables';

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
  ],
});
