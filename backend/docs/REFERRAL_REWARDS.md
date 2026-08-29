# Referral Rewards

Per-user referral codes with **subscription-driven attribution**. A code owner
earns a reward only when someone they referred completes their **first**
subscription. The on-chain referral contract is explicitly out of scope — all
reward accounting here is off-chain bookkeeping.

## Lifecycle

| Step | What happens | Table |
| --- | --- | --- |
| **Generate** | A user creates a code (`POST /v1/referral/codes`). Optional `maxUses`. | `referral_codes` |
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

## Fraud controls

- **Self-referral rejected.** `owner_id === redeemer_id` is refused at claim time
  (`400`) and re-checked at attribution time (attribution becomes a no-op, no
  reward, no `use_count` bump).
- **One claim per (code, fan).** Enforced by
  `UQ_referral_redemptions_code_redeemer`; a repeat claim returns `409`.
- **Capacity.** A code past `max_uses` cannot be claimed or attributed.
- **Deactivation.** An inactive code cannot be claimed or attributed.

## Out of scope

- On-chain referral contract / on-chain reward settlement.
- Multi-level / chained referrals.
- Referee-side incentives (only the code owner is rewarded).
