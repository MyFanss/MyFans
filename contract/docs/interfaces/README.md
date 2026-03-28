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

