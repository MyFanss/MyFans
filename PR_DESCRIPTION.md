## Description
Initialize Soroban contracts workspace for MyFans platform with foundational structure and stub contract.

## Changes
- ✅ Created `contract/` workspace with root Cargo.toml
- ✅ Added `contracts/myfans-token/` stub contract
- ✅ Configured soroban-sdk 21.7.0 as workspace dependency
- ✅ Added optimized release profiles for WASM builds
- ✅ Implemented basic instantiation test
- ✅ Added README with build/test instructions

## Testing
```bash
cd contract
cargo build    # ✅ Passes
cargo test     # ✅ 1 test passed
```

## Acceptance Criteria
- [x] `cargo build` succeeds for workspace
- [x] Stub contract compiles
- [x] Basic instantiation test passes
- [x] Workspace structure ready for additional contracts

## Next Steps
- Implement subscription lifecycle contract
- Add payment routing and fee logic
- Add access control functions
