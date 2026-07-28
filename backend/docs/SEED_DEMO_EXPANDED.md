# Expanded Demo Seed

## Problem

`scripts/seed-demo-creators.ts` only seeds 3 creator profiles with no
posts, subscriptions, or conversations. The frontend demo needs enough
entities across creators, posts, subscriptions, and conversations to show
feeds, gated/premium content, and messaging — not just empty profiles.

## Solution added here

`scripts/seed-demo-expanded.ts` — additive, run **after**
`seed-demo-creators.ts` against the same database:

```
npx ts-node -r tsconfig-paths/register scripts/seed-demo-creators.ts
npx ts-node -r tsconfig-paths/register scripts/seed-demo-expanded.ts
```

`--clean` removes the previously-seeded expanded rows (fans, their
messages/conversations, and the fake subscription_index rows) without
touching the base creators.

It adds:

- 2 demo fan accounts (`demo_fan_dave`, `demo_fan_erin`), password
  `Demo1234!` (same as the base seed).
- 2 posts per existing demo creator (`demo_alice`, `demo_bob`,
  `demo_carol`): one free/published, one premium.
- A `subscription_index` row linking each creator to a demo fan (uses a
  deterministic fake Stellar G-address per demo user — not a real wallet;
  fine for local/staging UI demos, not for contract-integration testing).
- A conversation + opening message between each creator and their linked
  demo fan.

## npm script

Not added to `package.json` (kept out-of-scope to avoid touching existing
files). Suggested addition for a follow-up PR:

```json
"seed:demo:expanded": "ts-node -r tsconfig-paths/register scripts/seed-demo-expanded.ts",
"seed:demo:expanded:clean": "ts-node -r tsconfig-paths/register scripts/seed-demo-expanded.ts --clean"
```

## Caveats

This script has not been run against a live database as part of this
change (no installs/build/test were performed). Column names were matched
against the current `Post`, `Conversation`, `Message`, and
`SubscriptionIndexEntity` entity definitions — verify against an actual
migrated schema (camelCase columns need double-quoting in raw SQL, as done
here) before wiring into CI or onboarding docs.
