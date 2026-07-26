import { Injectable } from '@nestjs/common';
import { ThrottlerGuard as NestThrottlerGuard } from '@nestjs/throttler';

/**
 * Stricter rate limit for /auth/login, /auth/challenge and
 * /auth/challenge/verify. The default @Throttle({ auth: { limit: 5, ttl:
 * 60000 } }) on these routes is shared with other "auth" bucket endpoints
 * and is generous enough to allow resource-exhaustion abuse (repeated
 * challenge generation / login attempts driving DB + bcrypt/signature-verify
 * load).
 *
 * This guard applies a tighter, dedicated limit: 3 requests per 60s per
 * client, tracked under its own throttler key so it doesn't share budget
 * with unrelated "auth" bucket routes.
 *
 * Not wired in yet — apply with:
 *   @UseGuards(ChallengeLoginThrottlerGuard)
 *   @Throttle({ challengeLogin: { limit: 3, ttl: 60000 } })
 *   @Post('login')
 */
@Injectable()
export class ChallengeLoginThrottlerGuard extends NestThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const ip = (req as { ip?: string }).ip ?? 'unknown';
    return `challenge-login:${ip}`;
  }
}

export const CHALLENGE_LOGIN_THROTTLE = {
  challengeLogin: { limit: 3, ttl: 60000 },
} as const;
