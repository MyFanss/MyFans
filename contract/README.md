# MyFans Soroban Contracts

Soroban smart contracts for the MyFans decentralized content subscription platform.

## Prerequisites

- Rust 1.70+
- `soroban-cli` (install: `cargo install soroban-cli`)

## Structure

```
contract/
├── Cargo.toml              # Workspace root
└── contracts/
    └── myfans-token/       # Stub contract
```

## Build

```bash
cd contract
cargo build
```

For optimized WASM:
```bash
cargo build --release --target wasm32-unknown-unknown
```

## Test

```bash
cd contract
cargo test
```

## Deploy (Testnet)

```bash
soroban contract build
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/myfans_token.wasm \
  --network testnet
```

## Next Steps

- Implement subscription lifecycle contract
- Add payment routing and fee logic
- Add access control functions
