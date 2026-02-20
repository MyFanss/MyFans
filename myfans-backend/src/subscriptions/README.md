# Subscription Entity

Links a fan (User) to a creator (Creator) with status, dates, and optional plan reference.

## Constraints

- **Unique active subscription**: Only one active subscription per (fan_id, creator_id), enforced by partial unique index (`WHERE status = 'active'`).
- Multiple cancelled/expired subscriptions for the same fan-creator pair are allowed.

## Status Transitions

| From   | To        | Description                          |
|--------|-----------|--------------------------------------|
| active | cancelled | User cancels before expiry           |
| active | expired   | Subscription period ends (expires_at)|
| cancelled | —       | Terminal state                       |
| expired   | —       | Terminal state                       |

## Indexes

- `(fan_id, creator_id)` - lookups by fan-creator pair
- `(creator_id, status)` - filter creator's subscribers by status
- Partial unique `(fan_id, creator_id) WHERE status = 'active'` - enforces one active per pair
