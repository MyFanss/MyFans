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
6. `treasury`
7. `creator-deposits`

## Signer Legend

- `admin`: current admin address stored by the contract
- `caller`: address that submits the invocation
- `none`: no `require_auth` check is enforced by the method

## myfans-token

| Method | Required signer(s) | Valid invocation example | Invalid invocation example |
| --- | --- | --- | --- |
| `initialize(env, admin, name, symbol, decimals, initial_supply)` | `none` | Any caller invokes once to set initial config. | Expecting non-admin caller to be rejected (it is not rejected by auth checks). |
| `admin(env)` | `none` | Any caller reads current admin. | Expecting signer/auth to be required for read. |
| `set_admin(env, new_admin)` | `admin` | Current admin signs and sets `new_admin`. | Non-admin signs, tries to rotate admin. |
| `set_metadata(env, new_name, new_symbol)` | `admin` | Current admin signs and updates token name/symbol. | Non-admin signs and tries to update metadata. |
| `name(env)` | `none` | Any caller reads token name. | Expecting signer/auth to be required for read. |
| `symbol(env)` | `none` | Any caller reads token symbol. | Expecting signer/auth to be required for read. |
| `decimals(env)` | `none` | Any caller reads token decimals. | Expecting signer/auth to be required for read. |
| `total_supply(env)` | `none` | Any caller reads total supply. | Expecting signer/auth to be required for read. |
| `approve(env, from, spender, amount, expiration_ledger)` | `from` | `from` signs and sets allowance to `spender`. | `spender` signs on behalf of `from`. |
| `transfer_from(env, spender, from, to, amount)` | `spender` | `spender` signs and spends from prior allowance. | `from` signs but `spender` does not. |
| `allowance(env, from, spender)` | `none` | Any caller queries active allowance. | Expecting signer/auth to be required for read. |
| `mint(env, to, amount)` | `admin` | Current admin signs and mints new tokens to `to`. | Non-admin signs and tries to mint; `require_auth` fails. |
| `balance(env, id)` | `none` | Any caller reads `id` balance. | Expecting signer/auth to be required for read. |
| `transfer(env, from, to, amount)` | `from` | `from` signs and transfers own balance. | Third-party caller submits transfer from `from` without `from` auth. |

## creator-registry

| Method | Required signer(s) | Valid invocation example | Invalid invocation example |
| --- | --- | --- | --- |
| `initialize(env, admin)` | `admin` | `admin` signs and initializes the contract once. | Attempt to initialize without `admin`'s signature. |
| `register_creator(env, caller, creator_address, creator_id)` | `caller`, and `caller` must be `admin` or `creator_address` | `admin` signs and registers a creator. | Random address signs as `caller` and tries to register another creator. |
| `get_creator_id(env, address)` | `none` | Any caller reads creator ID mapping. | Expecting signer/auth to be required for read. |

## subscription

| Method | Required signer(s) | Valid invocation example | Invalid invocation example |
| --- | --- | --- | --- |
| `init(env, admin, fee_bps, fee_recipient, token, price)` | `admin` | `admin` signs and initializes once with config values; `fee_bps` must be ≤ 1 000 (10%) and `fee_recipient` must be the treasury contract. | Non-admin caller initializes without `admin` signature; `fee_bps` over the cap is rejected. |
| `create_plan(env, creator, asset, amount, interval_days)` | `creator` | `creator` signs and creates a plan. | Non-creator caller submits plan for `creator`. |
| `subscribe(env, fan, plan_id, _token)` | `fan` | `fan` signs and subscribes to `plan_id`. | Another address tries to subscribe using `fan` as parameter without `fan` auth. |
| `is_subscriber(env, fan, creator)` | `none` | Any caller checks subscription status. | Expecting signer/auth to be required for read. |
| `extend_subscription(env, fan, creator, extra_ledgers, token)` | `fan` | `fan` signs and extends active subscription. | Third party extends `fan` subscription without `fan` auth. |
| `cancel(env, fan, creator, reason)` | `fan` | `fan` signs and cancels own subscription with reason code. | Creator tries to cancel fan subscription without `fan` auth. |
| `create_subscription(env, fan, creator, duration_ledgers)` | `fan` | `fan` signs and creates direct subscription. | Third party creates subscription for `fan` without `fan` auth. |
| `pause(env)` | `admin` | Current admin signs and pauses contract. | Non-admin caller pauses contract. |
| `unpause(env)` | `admin` | Current admin signs and unpauses contract. | Non-admin caller unpauses contract. |
| `is_paused(env)` | `none` | Any caller reads paused state. | Expecting signer/auth to be required for read. |
| `set_fee_bps(env, new_fee_bps)` | `admin` | Current admin updates fee bps (must be ≤ 1 000 = 10%). | Non-admin caller changes the protocol fee. |
| `set_fee_recipient(env, new_fee_recipient)` | `admin` | Current admin rotates the treasury contract address. | Non-admin caller rotates the fee recipient. |

> **Fee collection:** `subscribe`, `create_subscription` and `extend_subscription` route the
> fee into the treasury contract (`fee_recipient`) via its `deposit(from, amount)` entry
> point, which requires the fan's auth and honors the treasury's pause state.

## content-access

| Method | Required signer(s) | Valid invocation example | Invalid invocation example |
| --- | --- | --- | --- |
| `initialize(env, admin, token_address)` | `none` | Any caller initializes once with admin + token. | Re-initialization attempt after already initialized. |
| `unlock_content(env, buyer, creator, content_id)` | `buyer` | `buyer` signs and unlocks priced content. | Another caller tries to unlock on behalf of `buyer` without buyer signature. |
| `has_access(env, buyer, creator, content_id)` | `none` | Any caller checks access state. | Expecting signer/auth to be required for read. |
| `get_content_price(env, creator, content_id)` | `none` | Any caller reads configured content price. | Expecting signer/auth to be required for read. |
| `set_content_price(env, creator, content_id, price)` | `creator` | `creator` signs and sets own content price. | Non-creator tries to set `creator` price. |
| `set_admin(env, new_admin)` | `admin` | Current admin signs and updates admin. | Non-admin signs and tries to set new admin. |

## earnings

| Method | Required signer(s) | Valid invocation example | Invalid invocation example |
| --- | --- | --- | --- |
| `init(env, admin)` | `admin` | `admin` signs and initializes contract. | Any non-admin caller initializes without `admin` signature. |
| `admin(env)` | `none` | Any caller reads admin address. | Expecting signer/auth to be required for read. |
| `record(env, creator, amount)` | `admin` | Current admin signs and records creator earnings. | Non-admin caller records creator earnings. |
| `get_earnings(env, creator)` | `none` | Any caller reads creator earnings. | Expecting signer/auth to be required for read. |

## treasury

| Method | Required signer(s) | Valid invocation example | Invalid invocation example |
| --- | --- | --- | --- |
| `initialize(env, admin, token_address)` | `admin` | `admin` signs to initialize with token config. | Caller invokes without `admin` signature; `require_auth` fails. |
| `deposit(env, from, amount)` | `from` | `from` signs and transfers tokens into treasury (used by the subscription contract to collect protocol fees). | Third party calls deposit for `from` without `from` auth. |
| `withdraw(env, to, amount)` | `admin` | Current admin signs and withdraws to `to`. | Non-admin caller withdraws; `require_auth` fails and balances are unchanged. |
| `pause(env)` | `admin` | Current admin signs and pauses the treasury. | Non-admin caller pauses the treasury. |
| `unpause(env)` | `admin` | Current admin signs and unpauses the treasury. | Non-admin caller unpauses the treasury. |
| `is_paused(env)` | `none` | Any caller reads paused state. | Expecting signer/auth to be required for read. |
| `balance(env)` | `none` | Any caller reads the treasury token balance. | Expecting signer/auth to be required for read. |

> **Pause semantics:** while the treasury is paused, `deposit` reverts (subscription fee
> collection fails closed) and `withdraw` remains available to `admin` so funds are never
> locked. `deposit` emits a `Deposit` event carrying only `from` and `amount` (no off-chain
> PII) for indexers.

## creator-deposits

| Method | Required signer(s) | Valid invocation example | Invalid invocation example |
| --- | --- | --- | --- |
| `initialize(env, admin, token_address)` | `admin` | `admin` signs and initializes the contract once. | Non-admin caller initializes without `admin` signature. |
| `deposit(env, from, amount)` | `from` | `from` signs and deposits tokens into the contract. | Third party deposits on behalf of `from` without `from` auth. |
| `withdraw(env, to, amount)` | `admin` | Current admin signs and withdraws to `to`. | Non-admin caller withdraws; `require_auth` fails. |
| `balance(env)` | `none` | Any caller reads the contract token balance. | Expecting signer/auth to be required for read. |
