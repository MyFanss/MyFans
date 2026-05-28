# Changelog

All notable changes to this Soroban workspace are documented here.

## 0.1.1

### Changed

- Workspace crate versions aligned to **0.1.1**.
- **`soroban-sdk`** workspace dependency updated to **21.7.7** (from 21.7.0), with `Cargo.lock` kept in sync.

### Fixed

- **myfans-token**: Temporary allowance TTL is extended so entries remain readable through `expiration_ledger + 1`, allowing `transfer_from` to return `AllowanceExpired` instead of `NoAllowance` after Soroban 21.7 TTL behavior; TTL is refreshed after partial `transfer_from` and `clear_allowance`.
- **Tests**: Adjusted for SDK/host semantics (contract-scoped event emission, ledger jumps vs instance TTL, `WithdrawEvent` decoding, empty auths via `mock_auths(&[])` / `set_auths`, and related integration cases).

### Tooling

- `scripts/release-check.sh` asserts the workspace `soroban-sdk` pin in `Cargo.toml` (update the script when bumping the SDK).
