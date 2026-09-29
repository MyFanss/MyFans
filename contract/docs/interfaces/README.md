# MyFans Contract Interfaces

Comprehensive documentation for all public contract methods, including arguments, authorization requirements, runnable `soroban contract invoke` examples (local network), and expected events.

## Available Interfaces
- [MyFans Main (contract/src/lib.rs)](myfans-main.md)
- [Content Access](content-access.md)
- [Creator Deposits](creator-deposits.md)
- [Content Likes](content-likes.md)
- [Creator Registry](creator-registry.md)
- [Creator Earnings](creator-earnings.md)
- [Earnings](earnings.md)
- [Subscription](subscription.md)
- [MyFans Token](myfans-token.md)
- [Treasury Contracts](treasury-contracts.md)
- [Treasury src](treasury-src.md)

**All public contract methods documented with args, auth, examples, events. Examples runnable via `--dry-run`.**

## Usage
Examples assume local deployment (`contract/deployed-local.json`). Replace:
- `<CONTRACT_ID>`: Contract address from `deployed-local.json`
- `<TOKEN_ID>`: Token contract ID
- Addresses/IDs with test values.

Run: `soroban contract invoke --network local --source registry --wasm path/to/target.wasm --dry-run` to validate.

## Interface Ownership

Each interface doc is owned by a workspace member crate declared in `contract/Cargo.toml`.
The crate source lives at `contracts/<crate>/src/lib.rs` and must expose the methods
documented here. When a member is listed in `contract/Cargo.toml` but its source is
missing, `cargo test --workspace` cannot compile and ABI tooling silently no-ops.

| Interface doc | Owning crate | Source path |
| --- | --- | --- |
| [MyFans Main](myfans-main.md) | `myfans-main` | `contracts/myfans-main/src/lib.rs` |
| [Content Access](content-access.md) | `content-access` | `contracts/content-access/src/lib.rs` |
| [Creator Deposits](creator-deposits.md) | `creator-deposits` | `contracts/creator-deposits/src/lib.rs` |
| [Content Likes](content-likes.md) | `content-likes` | `contracts/content-likes/src/lib.rs` |
| [Creator Registry](creator-registry.md) | `creator-registry` | `contracts/creator-registry/src/lib.rs` |
| [Creator Earnings](creator-earnings.md) | `creator-earnings` | `contracts/creator-earnings/src/lib.rs` |
| [Earnings](earnings.md) | `earnings` | `contracts/earnings/src/lib.rs` |
| [Subscription](subscription.md) | `subscription` | `contracts/subscription/src/lib.rs` |
| [MyFans Token](myfans-token.md) | `myfans-token` | `contracts/myfans-token/src/lib.rs` |
| [Treasury Contracts](treasury-contracts.md) | `treasury` | `contracts/treasury/src/lib.rs` |
| [Treasury src](treasury-src.md) | `treasury` | `contracts/treasury/src/lib.rs` |

Shared error types used across members are provided by the `myfans-lib` crate
(`contracts/myfans-lib/src/lib.rs`). All member crates target MSRV 1.74 and pin a
single `soroban-sdk` version to avoid version skew.

## Drift Check

To ensure contract interface docs stay linked to code, run:

- `npm run check:interfaces` (validates all `docs/interfaces/*.md` method tables against referenced `contracts/**/src/lib.rs` files)
- `npm run test:interfaces` (parser/unit tests for the drift check)

The release checklist (`npm run release-check`) now includes the interface drift check.
