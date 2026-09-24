# Referral Rewards

Per-user referral codes with **subscription-driven attribution**. A code owner
earns a reward only when someone they referred completes their **first**
subscription. The on-chain referral contract is explicitly out of scope — all
reward accounting here is off-chain bookkeeping.

## Lifecycle

| Step | What happens | Table |
| --- | --- | --- |
| **Generate** | A user creates a code (`POST /v1/referral/codes`). Optional `maxUses`. Rate-limited per user (see Fraud controls). | `referral_codes` |
| **Claim** | A fan applies a code at checkout (`POST /v1/referral/redeem`). Records a **pending** redemption with the fan's Stellar address. No reward yet, `use_count` unchanged. | `referral_redemptions` (`attributed_at IS NULL`) |
| **Attribute** | The first `SubscriptionCreatedEvent` for that Stellar address is consumed by `ReferralAttributionConsumer` → `ReferralService.attributeForSubscriber`. Sets `attributed_at`, increments the code's `use_count`, and grants the owner reward. | `referral_rewards` |

Only `SubscriptionCreatedEvent` is subscribed to. `SubscriptionRenewedEvent`,
`SubscriptionCancelledEvent`, and `SubscriptionExpiredEvent` are intentionally
**not** wired, which is what guarantees:

- **Code applies on first subscribe** — attribution fires exactly once, on the
  `created` event.
- **Renew does not re-pay** — renewals emit `renewed`, which no referral code
  observes; and even if `attributeForSubscriber` were re-invoked, the redemption
  is already `attributed_at`-stamped so it is a no-op.

## Reward types

Configured per-environment (no deploy needed to switch the program):

| Env var | Default | Meaning |
| --- | --- | --- |
| `REFERRAL_REWARD_KIND` | `OFF_CHAIN_CREDIT` | `OFF_CHAIN_CREDIT` or `FEE_DISCOUNT` |
| `REFERRAL_REWARD_CREDIT_AMOUNT` | `5` | Token quantity credited to the owner's off-chain balance ledger (kind `OFF_CHAIN_CREDIT`). |
| `REFERRAL_REWARD_FEE_DISCOUNT_BPS` | `1000` | Basis points (1000 = 10%) discount applied to the owner's next platform fee (kind `FEE_DISCOUNT`). |

The `referral_rewards` row (`kind`, `amount`, `status = GRANTED`) is the record
of intent. Settling it — moving credit onto the balance ledger or wiring the
discount into fee calculation — is handled by the earnings/fee subsystem
consuming `referral_rewards`, and is out of scope for this module.

`GET /v1/referral/rewards` lists the rewards a user has earned as a code owner.

## Feature flag

The share panel and all referral UI are gated behind
`NEXT_PUBLIC_FLAG_REFERRAL_CODES`, which **defaults to off**. When the flag is
unset or `false`, the share panel is not rendered and no referral endpoints are
called from the client. The backend module may be deployed ahead of the flag
flip; the flag is the single switch that exposes the feature to users.

## Fraud controls

- **Self-referral rejected.** `owner_id === redeemer_id` is refused at claim time
  (`400`) and re-checked at attribution time (attribution becomes a no-op, no
  reward, no `use_count` bump).
- **One claim per (code, fan).** Enforced by
  `UQ_referral_redemptions_code_redeemer`; a repeat claim returns `409`.
- **Capacity.** A code past `max_uses` cannot be claimed or attributed.
- **Deactivation.** An inactive code cannot be claimed or attributed.
- **Rate-limited code creation.** `POST /v1/referral/codes` is rate-limited per
  user so a single account cannot mint codes in bulk to farm redemptions.
- **Circular chains rejected.** Attribution walks the referral graph and refuses
  any chain that would loop back to an ancestor (A→B→A), so mutually-referring
  accounts cannot pay each other.
- **Late attribution rejected.** A redemption can only be attributed on the
  referred user's **first** subscription. If the subscriber already had a
  subscription before the claim, attribution is refused — a code cannot be
  applied retroactively to an existing subscriber.
- **Single-winner attribution.** Attribution is idempotent and guarded so that
  only one redemption can ever be attributed per subscriber; a second concurrent
  or subsequent attempt is a no-op. Double attribution is impossible.

## Privacy

Share URLs carry only the referral code — no PII (no email, user id, or Stellar
address) is embedded in or derivable from the shared link.

## Out of scope

- On-chain referral contract / on-chain reward settlement.
- Multi-level / chained referrals (MLM).
- Referee-side incentives (only the code owner is rewarded).
