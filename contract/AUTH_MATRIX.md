# Contract Authorization Matrix

This document is the source of truth for signer requirements on public methods exposed by the deployed MyFans Soroban contracts.

Storage-key naming and compatibility guidance lives in [STORAGE_KEYS.md](./STORAGE_KEYS.md).

## Scope

Contracts covered here (deployed by `contract/scripts/deploy.sh`):

1. `myfans-token`
2. `creator-registry`
3. `subscription`
4. `content-access`
5. `earnings`

## Signer Legend

- `admin`: current admin address stored by the contract
- `caller`: address that submits the invocation
- `none`: no `require_auth` check is enforced by the method

## Coverage Rule

Every public method is listed below, including read-only methods. Read-only methods are listed explicitly as `none` so reviewers can confirm they are intentionally unauthenticated rather than accidentally omitted. Every mutating entrypoint must have a row with a signer requirement, a valid invocation example, an invalid invocation example, and the storage effect when the call is denied.

## myfans-token

| Method | Mutating | Required signer(s) | Valid invocation example | Invalid invocation example | Storage effect on deny |
| --- | --- | --- | --- | --- | --- |
| `initialize(env, admin, name, symbol, decimals, initial_supply)` | yes | `none` | Any caller invokes once to set initial config. | Expecting non-admin caller to be rejected (it is not rejected by auth checks). | No state written; call reverts on already-initialized guard. |
| `admin(env)` | no | `none` | Any caller reads current admin. | Expecting signer/auth to be required for read. | No state written (read-only). |
| `set_admin(env, new_admin)` | yes | `admin` | Current admin signs and sets `new_admin`. | Non-admin signs, tries to rotate admin. | Admin key unchanged; call reverts before write. |
| `set_metadata(env, new_name, new_symbol)` | yes | `admin` | Current admin signs and updates token name/symbol. | Non-admin signs and tries to update metadata. | Name/symbol unchanged; call reverts before write. |
| `name(env)` | no | `none` | Any caller reads token name. | Expecting signer/auth to be required for read. | No state written (read-only). |
| `symbol(env)` | no | `none` | Any caller reads token symbol. | Expecting signer/auth to be required for read. | No state written (read-only). |
| `decimals(env)` | no | `none` | Any caller reads token decimals. | Expecting signer/auth to be required for read. | No state written (read-only). |
| `total_supply(env)` | no | `none` | Any caller reads total supply. | Expecting signer/auth to be required for read. | No state written (read-only). |
| `approve(env, from, spender, amount, expiration_ledger)` | yes | `from` | `from` signs and sets allowance to `spender`. | `spender` signs on behalf of `from`. | Allowance unchanged; call reverts before write. |
| `transfer_from(env, spender, from, to, amount)` | yes | `spender` | `spender` signs and spends from prior allowance. | `from` signs but `spender` does not. | Balances and allowance unchanged; call reverts before write. |
| `allowance(env, from, spender)` | no | `none` | Any caller queries active allowance. | Expecting signer/auth to be required for read. | No state written (read-only). |
| `mint(env, to, amount)` | yes | `none` | Any caller invokes mint to increase `to` balance. | Expecting only admin to mint (not enforced by auth checks). | No state written on auth failure (no auth check); supply/balance only change on success. |
| `balance(env, id)` | no | `none` | Any caller reads `id` balance. | Expecting signer/auth to be required for read. | No state written (read-only). |
| `transfer(env, from, to, amount)` | yes | `from` | `from` signs and transfers own balance. | Third-party caller submits transfer from `from` without `from` auth. | Balances unchanged; call reverts before write. |

## creator-registry

| Method | Mutating | Required signer(s) | Valid invocation example | Invalid invocation example | Storage effect on deny |
| --- | --- | --- | --- | --- | --- |
| `initialize(env, admin)` | yes | `none` | Any caller initializes contract with `admin`. | Re-initialization attempt after already initialized. | No state written; call reverts on already-initialized guard. |
| `register_creator(env, caller, creator_address, creator_id)` | yes | `caller`, and `caller` must be `admin` or `creator_address` | `admin` signs and registers a creator. | Random address signs as `caller` and tries to register another creator. | Creator mapping unchanged; call reverts before write. |
| `get_creator_id(env, address)` | no | `none` | Any caller reads creator ID mapping. | Expecting signer/auth to be required for read. | No state written (read-only). |

## subscription

| Method | Mutating | Required signer(s) | Valid invocation example | Invalid invocation example | Storage effect on deny |
| --- | --- | --- | --- | --- | --- |
| `init(env, admin, fee_bps, fee_recipient, token, price)` | yes | `none` | Any caller initializes once with config values. | Re-initialization attempt after already initialized. | No state written; call reverts on already-initialized guard. |
| `create_plan(env, creator, asset, amount, interval_days)` | yes | `creator` | `creator` signs and creates a plan. | Non-creator caller submits plan for `creator`. | No plan stored; call reverts before write. |
| `subscribe(env, fan, plan_id, _token)` | yes | `fan` | `fan` signs and subscribes to `plan_id`. | Another address tries to subscribe using `fan` as parameter without `fan` auth. | Subscription state unchanged; call reverts before write. |
| `is_subscriber(env, fan, creator)` | no | `none` | Any caller checks subscription status. | Expecting signer/auth to be required for read. | No state written (read-only). |
| `extend_subscription(env, fan, creator, extra_ledgers, token)` | yes | `fan` | `fan` signs and extends active subscription. | Third party extends `fan` subscription without `fan` auth. | Expiry unchanged; call reverts before write. |
| `cancel(env, fan, creator, reason)` | yes | `fan` | `fan` signs and cancels own subscription with reason code. | Creator tries to cancel fan subscription without `fan` auth. | Subscription state unchanged; call reverts before write. |
| `create_subscription(env, fan, creator, duration_ledgers)` | yes | `fan` | `fan` signs and creates direct subscription. | Third party creates subscription for `fan` without `fan` auth. | No subscription stored; call reverts before write. |
| `pause(env)` | yes | `admin` | Current admin signs and pauses contract. | Non-admin caller pauses contract. | Paused flag unchanged; call reverts before write. |
| `unpause(env)` | yes | `admin` | Current admin signs and unpauses contract. | Non-admin caller unpauses contract. | Paused flag unchanged; call reverts before write. |
| `is_paused(env)` | no | `none` | Any caller reads paused state. | Expecting signer/auth to be required for read. | No state written (read-only). |

## content-access

| Method | Mutating | Required signer(s) | Valid invocation example | Invalid invocation example | Storage effect on deny |
| --- | --- | --- | --- | --- | --- |
| `initialize(env, admin, token_address)` | yes | `none` | Any caller initializes once with admin + token. | Re-initialization attempt after already initialized. | No state written; call reverts on already-initialized guard. |
| `unlock_content(env, buyer, creator, content_id)` | yes | `buyer` | `buyer` signs and unlocks priced content. | Another caller tries to unlock on behalf of `buyer` without buyer signature. | Access record unchanged; call reverts before write. |
| `has_access(env, buyer, creator, content_id)` | no | `none` | Any caller checks access state. | Expecting signer/auth to be required for read. | No state written (read-only). |
| `get_content_price(env, creator, content_id)` | no | `none` | Any caller reads configured content price. | Expecting signer/auth to be required for read. | No state written (read-only). |
| `set_content_price(env, creator, content_id, price)` | yes | `creator` | `creator` signs and sets own content price. | Non-creator tries to set `creator` price. | Price unchanged; call reverts before write. |
| `set_admin(env, new_admin)` | yes | `admin` | Current admin signs and updates admin. | Non-admin signs and tries to set new admin. | Admin key unchanged; call reverts before write. |

## earnings

| Method | Mutating | Required signer(s) | Valid invocation example | Invalid invocation example | Storage effect on deny |
| --- | --- | --- | --- | --- | --- |
| `init(env, admin)` | yes | `admin` | `admin` signs and initializes contract. | Any non-admin caller initializes without `admin` signature. | No state written; call reverts before write. |
| `admin(env)` | no | `none` | Any caller reads admin address. | Expecting signer/auth to be required for read. | No state written (read-only). |
| `record(env, creator, amount)` | yes | `admin` | Current admin signs and records creator earnings. | Non-admin caller records creator earnings. | Earnings unchanged; call reverts before write. |
| `get_earnings(env, creator)` | no | `none` | Any caller reads creator earnings. | Expecting signer/auth to be required for read. | No state written (read-only). |

## Role Expectations

- `admin`: privileged operator. Only the stored admin address may rotate admin, pause/unpause, set metadata, or record earnings. Admin cannot act as a fan or creator without that address's own signature.
- `creator`: owns plans and content prices. A creator signature authorizes only that creator's own resources; it does not authorize another creator's plan or price.
- `fan` / `buyer`: owns subscriptions and content unlocks. A fan signature authorizes only that fan's own subscription, extension, cancellation, and unlock actions.

## Maintenance Rule (Required)

When a contract interface or authorization rule changes:

1. Update this matrix in the same PR.
2. Ensure every new/changed public method has signer requirements plus valid/invalid examples and the storage effect on deny.
3. Keep method signatures aligned with `src/lib.rs` definitions.
4. Add or update the corresponding row test in `tests/auth_matrix.rs` for the affected crate.
