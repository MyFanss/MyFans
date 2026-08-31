/**
 * Referral program client.
 *
 * Claiming a code only records a *pending* redemption. The reward is granted
 * server-side when the fan's first `SubscriptionCreatedEvent` is attributed
 * to the claim — renewals never re-pay. See `docs/REFERRAL_REWARDS.md`.
 */
import { getVersionedApiBaseUrl } from '@/lib/api/base-url';
import { getAuthHeaders } from '@/lib/api-utils';
import { csrfFetch } from '@/lib/api/csrf-fetch';

export interface ClaimReferralResult {
  ok: boolean;
  /** Present when the claim was rejected (self-referral, exhausted, ...). */
  reason?: string;
}

/**
 * Claim a referral code for the current user ahead of subscribing.
 *
 * `subscriberAddress` is the fan's Stellar address; the backend uses it to
 * match the first incoming `SubscriptionCreatedEvent` back to this claim.
 * Already-claimed (409) is treated as success so re-applying a code at
 * checkout is harmless.
 */
export async function claimReferralCode(
  code: string,
  subscriberAddress: string,
): Promise<ClaimReferralResult> {
  try {
    const res = await csrfFetch(`${getVersionedApiBaseUrl()}/referral/redeem`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify({ code, subscriberAddress }),
    });

    if (res.ok || res.status === 409) return { ok: true };

    const data = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, reason: data.message ?? 'Could not apply referral code' };
  } catch {
    return { ok: false, reason: 'Could not reach the referral service' };
  }
}
