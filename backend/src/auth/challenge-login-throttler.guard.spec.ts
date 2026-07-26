import { ChallengeLoginThrottlerGuard, CHALLENGE_LOGIN_THROTTLE } from './challenge-login-throttler.guard';

describe('ChallengeLoginThrottlerGuard', () => {
  it('exposes a stricter limit than the shared auth bucket (5/60s)', () => {
    expect(CHALLENGE_LOGIN_THROTTLE.challengeLogin.limit).toBeLessThan(5);
    expect(CHALLENGE_LOGIN_THROTTLE.challengeLogin.ttl).toBe(60000);
  });

  it('tracks clients by a dedicated per-IP key so budget is not shared', async () => {
    const guard = new ChallengeLoginThrottlerGuard(
      {} as never,
      {} as never,
      {} as never,
    );
    const tracker = await (
      guard as unknown as {
        getTracker: (req: Record<string, unknown>) => Promise<string>;
      }
    ).getTracker({ ip: '203.0.113.5' });

    expect(tracker).toBe('challenge-login:203.0.113.5');
  });

  it('falls back to "unknown" when the request has no ip', async () => {
    const guard = new ChallengeLoginThrottlerGuard(
      {} as never,
      {} as never,
      {} as never,
    );
    const tracker = await (
      guard as unknown as {
        getTracker: (req: Record<string, unknown>) => Promise<string>;
      }
    ).getTracker({});

    expect(tracker).toBe('challenge-login:unknown');
  });
});
