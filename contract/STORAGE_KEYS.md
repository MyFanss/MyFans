# Storage Keys Reference — MyFans Soroban Workspace

> **Living document.** Every storage key used by a deployed crate MUST appear
> here with its type, durability, and indexer mapping. A PR that adds, renames,
> or removes a key MUST update this file in the same commit (enforced by the
> PR template contract checklist).

---

## Table of Contents

1. [How to read this document](#how-to-read-this-document)
2. [Key durability glossary](#key-durability-glossary)
3. [Crate: `subscription`](#crate-subscription)
4. [Crate: `creator-registry`](#crate-creator-registry)
5. [Crate: `content-access`](#crate-content-access)
6. [Crate: `earnings`](#crate-earnings)
7. [Crate: `myfans-token`](#crate-myfans-token)
8. [Crate: `creator-deposits`](#crate-creator-deposits)
9. [Crate: `creator-earnings`](#crate-creator-earnings)
10. [Crate: `treasury`](#crate-treasury)
11. [Crate: `myfans-lib`](#crate-myfans-lib)
12. [Crate: `myfans-contract`](#crate-myfans-contract)
13. [Crate: `test-consumer`](#crate-test-consumer)
14. [Crate: `content-likes`](#crate-content-likes)
15. [Indexer mapping](#indexer-mapping)
16. [Migration notes](#migration-notes)
17. [How to regenerate this document](#how-to-regenerate-this-document)

---

## How to read this document

| Column | Meaning |
|---|---|
| **Key** | The `DataKey` variant or literal value written to contract storage |
| **Rust type** | The Rust value type stored under this key |
| **Soroban XDR type** | The `ScVal` representation on-chain |
| **Durability** | `Instance`, `Persistent`, or `Temporary` |
| **TTL policy** | How TTL is managed (bumped on access, fixed, etc.) |
| **Indexer field** | The backend DB column / event field that mirrors this key |
| **Added in** | Workspace version when this key was introduced |
| **Notes** | Migration guidance, deprecation status, re-use warnings |

> **No silent key reuse.** If a key variant is reused for a semantically
> different purpose in a new version, it MUST get a new variant name. Reusing
> a key variant across incompatible value types corrupts existing state without
> an obvious error.

---

## Key durability glossary

| Durability | Eviction behaviour | Typical use |
|---|---|---|
| `Instance` | Evicted when the contract instance is archived | Contract-global config (admin, fee BPS, paused flag) |
| `Persistent` | Independently TTL-controlled; survives instance archival | Per-entity state (plans, subscriptions, allowances) |
| `Temporary` | Evicted after TTL ledgers unconditionally | Nonces, short-lived session data |

---

## Crate: `subscription`

The main subscription lifecycle contract.

### `DataKey` enum variants

| Key | Rust type | XDR type | Durability | TTL policy | Indexer field | Added in |
|---|---|---|---|---|---|---|
| `Admin` | `Address` | `ScVal::Address` | `Instance` | Bumped on every write | — | 0.1.0 |
| `ProtocolFeeBps` | `u32` | `ScVal::U32` | `Instance` | Bumped on every write | — | 0.1.0 |
| `FeeRecipient` | `Address` | `ScVal::Address` | `Instance` | Bumped on every write | — | 0.1.0 |
| `Paused` | `bool` | `ScVal::Bool` | `Instance` | Bumped on every write | — | 0.1.0 |
| `PlanCounter` | `u32` | `ScVal::U32` | `Instance` | Bumped on read/write | — | 0.1.0 |
| `Plan(u32)` | `PlanRecord` (struct) | `ScVal::Map` | `Persistent` | Bumped on create; extended on renew | `plans.plan_id` | 0.1.0 |
| `Subscription(Address, Address)` | `SubscriptionRecord` (struct) | `ScVal::Map` | `Persistent` | Extended on renew; cleared on cancel | `subscriptions.(fan, creator)` | 0.1.0 |

#### `PlanRecord` fields

```rust
pub struct PlanRecord {
    pub creator: Address,
    pub token:   Address,
    pub amount:  i128,
    pub interval_days: u32,
    pub active:  bool,
}
```

#### `SubscriptionRecord` fields

```rust
pub struct SubscriptionRecord {
    pub plan_id:     u32,
    pub start_ledger: u32,
    pub expiry_ledger: u32,
    pub token:       Address,
}
```

---

## Crate: `creator-registry`

Stores creator profile metadata and on-chain registry entries.

| Key | Rust type | XDR type | Durability | TTL policy | Indexer field | Added in |
|---|---|---|---|---|---|---|
| `Admin` | `Address` | `ScVal::Address` | `Instance` | Bumped on write | — | 0.1.0 |
| `Creator(Address)` | `CreatorRecord` (struct) | `ScVal::Map` | `Persistent` | Bumped on register/update | `creators.stellar_address` | 0.1.0 |
| `CreatorCount` | `u32` | `ScVal::U32` | `Instance` | Bumped on write | — | 0.1.0 |

#### `CreatorRecord` fields

```rust
pub struct CreatorRecord {
    pub name:        String,
    pub ipfs_hash:   String,
    pub active:      bool,
    pub registered_at: u64, // Unix timestamp (seconds)
}
```

---

## Crate: `content-access`

Gates read access to content items based on subscription state.

| Key | Rust type | XDR type | Durability | TTL policy | Indexer field | Added in |
|---|---|---|---|---|---|---|
| `Admin` | `Address` | `ScVal::Address` | `Instance` | Bumped on write | — | 0.1.0 |
| `SubscriptionContract` | `Address` | `ScVal::Address` | `Instance` | Bumped on init | — | 0.1.0 |
| `ContentItem(BytesN<32>)` | `ContentRecord` (struct) | `ScVal::Map` | `Persistent` | Extended on publish | `content.cid_hash` | 0.1.0 |

#### `ContentRecord` fields

```rust
pub struct ContentRecord {
    pub creator:   Address,
    pub ipfs_cid:  String,
    pub tier:      u32,
    pub published_at: u64,
}
```

---

## Crate: `earnings`

Tracks per-creator earnings and allows withdrawals.

| Key | Rust type | XDR type | Durability | TTL policy | Indexer field | Added in |
|---|---|---|---|---|---|---|
| `Admin` | `Address` | `ScVal::Address` | `Instance` | Bumped on write | — | 0.1.0 |
| `TokenContract` | `Address` | `ScVal::Address` | `Instance` | Bumped on init | — | 0.1.0 |
| `Balance(Address)` | `i128` | `ScVal::I128` | `Persistent` | Bumped on deposit/withdraw | `earnings.creator` | 0.1.0 |
| `TotalPaid(Address)` | `i128` | `ScVal::I128` | `Persistent` | Bumped on withdrawal | `earnings.total_withdrawn` | 0.1.0 |

---

## Crate: `myfans-token`

SEP-41 compliant fungible token (optional; used for plan-specific tokens).

| Key | Rust type | XDR type | Durability | TTL policy | Indexer field | Added in |
|---|---|---|---|---|---|---|
| `Admin` | `Address` | `ScVal::Address` | `Instance` | Bumped on write | — | 0.1.0 |
| `Balance(Address)` | `i128` | `ScVal::I128` | `Persistent` | Bumped on transfer/mint | — | 0.1.0 |
| `Allowance(Address, Address)` | `AllowanceRecord` | `ScVal::Map` | `Temporary` | TTL = `expiration_ledger + 1` (extended after partial `transfer_from`) | — | 0.1.0 |
| `TotalSupply` | `i128` | `ScVal::I128` | `Instance` | Bumped on mint/burn | — | 0.1.0 |
| `Decimals` | `u32` | `ScVal::U32` | `Instance` | Written once on init | — | 0.1.0 |
| `Name` | `String` | `ScVal::String` | `Instance` | Written once on init | — | 0.1.0 |
| `Symbol` | `String` | `ScVal::String` | `Instance` | Written once on init | — | 0.1.0 |

#### `AllowanceRecord` fields

```rust
pub struct AllowanceRecord {
    pub amount:           i128,
    pub expiration_ledger: u32,
}
```

> **Note (0.1.1 fix):** Temporary allowance TTL is extended to
> `expiration_ledger + 1` so entries remain readable through the expiry ledger,
> allowing `transfer_from` to return `AllowanceExpired` instead of `NoAllowance`
> after Soroban 21.7 TTL semantics. See CHANGELOG.md for details.

---

## Crate: `creator-deposits`

Escrow-style deposits held on behalf of creators (e.g. for dispute windows).

| Key | Rust type | XDR type | Durability | TTL policy | Indexer field | Added in |
|---|---|---|---|---|---|---|
| `Admin` | `Address` | `ScVal::Address` | `Instance` | Bumped on write | — | 0.1.0 |
| `Deposit(Address)` | `i128` | `ScVal::I128` | `Persistent` | Bumped on deposit/release | `deposits.creator` | 0.1.0 |

---

## Crate: `creator-earnings`

Thin wrapper for earnings accumulation routed via the main `earnings` crate.

| Key | Rust type | XDR type | Durability | TTL policy | Indexer field | Added in |
|---|---|---|---|---|---|---|
| `Admin` | `Address` | `ScVal::Address` | `Instance` | Bumped on write | — | 0.1.0 |
| `EarningsContract` | `Address` | `ScVal::Address` | `Instance` | Bumped on init | — | 0.1.0 |

---

## Crate: `treasury`

Protocol fee accumulation and admin-controlled disbursement.

| Key | Rust type | XDR type | Durability | TTL policy | Indexer field | Added in |
|---|---|---|---|---|---|---|
| `Admin` | `Address` | `ScVal::Address` | `Instance` | Bumped on write | — | 0.1.0 |
| `Balance` | `i128` | `ScVal::I128` | `Persistent` | Bumped on fee receipt/disburse | `treasury.balance` | 0.1.0 |

---

## Crate: `myfans-lib`

Shared library crate — **no contract storage** (pure Rust types and helpers).

---

## Crate: `myfans-contract`

Top-level integration facade — delegates storage entirely to sub-contracts.
All persistent state is held by the crates listed above.

---

## Crate: `test-consumer`

Test-only harness — **no deployed storage**. Used only in `cargo test`.

---

## Crate: `content-likes`

Tracks per-content like counts.

| Key | Rust type | XDR type | Durability | TTL policy | Indexer field | Added in |
|---|---|---|---|---|---|---|
| `Admin` | `Address` | `ScVal::Address` | `Instance` | Bumped on write | — | 0.1.0 |
| `LikeCount(BytesN<32>)` | `u64` | `ScVal::U64` | `Persistent` | Bumped on like/unlike | `content_likes.cid_hash` | 0.1.0 |
| `UserLiked(Address, BytesN<32>)` | `bool` | `ScVal::Bool` | `Persistent` | Bumped on like/unlike | — | 0.1.0 |

---

## Indexer mapping

The backend event-indexer service (`backend/src/events/`) subscribes to Soroban
contract events and keeps a local cache of contract state. The table below maps
storage keys to the backend DB columns that mirror them.

| Contract | Storage key | Backend module | DB table / column |
|---|---|---|---|
| `subscription` | `Subscription(fan, creator)` | `subscriptions` | `subscriptions.(fan_address, creator_address)` |
| `subscription` | `Plan(plan_id)` | `subscriptions` | `plans.plan_id` |
| `creator-registry` | `Creator(address)` | `creators` | `creators.stellar_address` |
| `content-access` | `ContentItem(cid)` | `content` | `content.cid_hash` |
| `earnings` | `Balance(creator)` | `earnings` | `earnings.balance` |
| `content-likes` | `LikeCount(cid)` | `likes` | `content_likes.count` |

> **For indexer authors:** When a key is renamed or its value type changes,
> a backend migration MUST accompany the contract upgrade. See
> [contract/docs/UPGRADE_NOTES.md](./docs/UPGRADE_NOTES.md) for the migration
> protocol.

---

## Migration notes

### v0.1.0 → v0.1.1

- No storage key additions, removals, or type changes.
- `myfans-token` `Allowance` TTL behaviour corrected (see token crate notes above).

### Adding a new key (checklist)

1. Add the `DataKey` variant in Rust source.
2. Add a row to the relevant crate table in this file.
3. Add an indexer mapping entry if the backend caches this key.
4. If the key replaces an old key, document the migration in
   [contract/docs/UPGRADE_NOTES.md](./docs/UPGRADE_NOTES.md).
5. Tick the **"Storage key doc updated"** checkbox in the PR template.

### Removing or renaming a key

1. Do **not** reuse the old variant name for a different type.
2. Add an `UPGRADE_NOTES.md` entry describing the migration path (delete old
   entries, re-index from events, etc.).
3. Update the indexer before or simultaneously with the contract deploy.

---

## How to regenerate this document

This document is maintained manually — a future `scripts/check-storage-drift.sh`
(tracked as a follow-up to issue #1642) can grep for `DataKey` variants across
all workspace crates and warn if a variant is absent from this file.

**To manually verify no key is missing:**

```bash
# List all DataKey variants across the workspace
grep -r 'DataKey' contract/contracts/*/src/ --include='*.rs' -h \
  | grep -oP '(?<=::|enum |fn )\w+' | sort | uniq

# Diff the list against this document
```

> When `scripts/check-storage-drift.sh` is implemented, the CI `contract` job
> will run it automatically and fail on drift. Until then, the PR checklist
> item is the enforcement mechanism.
