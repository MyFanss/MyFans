# Creator Entity

Creator is a one-to-one extension of `User` when `user.is_creator` is true. It stores creator-specific fields without duplicating user data.

## Relation to User

- **Constraint**: `user.is_creator` should match the existence of a Creator row. When `is_creator` is true, a Creator record must exist. When false, no Creator record should exist.
- **Cascade delete**: When a User is deleted, the associated Creator row is automatically deleted (database-level `ON DELETE CASCADE`).

## Fields

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to users (unique) |
| bio | text | Creator biography |
| subscription_price | decimal(18,6) | Subscription price |
| currency | string | e.g. XLM, USDC |
| is_verified | boolean | Verification status |
| created_at | timestamp | |
| updated_at | timestamp | |
