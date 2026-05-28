# MyFans Soroban Contracts

Smart contracts and deployment automation for MyFans on Stellar/Soroban.

## Authorization matrix

Use [`AUTH_MATRIX.md`](./AUTH_MATRIX.md) for method-by-method signer requirements, including valid/invalid invocation examples for each public method in deployed contracts.

When any contract interface or auth rule changes, update `AUTH_MATRIX.md` in the same PR.

## Contract Interface Documentation

See comprehensive method docs (args, auth, examples, events): [docs/interfaces/](docs/interfaces/)

## Contracts deployed by script

1. `myfans-token`
2. `creator-registry`
3. `subscription`
4. `content-access`
5. `earnings`

The deploy script applies this order to keep initialization/dependency flow deterministic.

## Workspace layout and versions

The workspace root is `contract/Cargo.toml`. Shared crate metadata (`version`, `edition`, `authors`, `license`, `repository`, `description`, `publish`) lives under `[workspace.package]`. The Soroban SDK pin is declared once in `[workspace.dependencies]` (`soroban-sdk`) and referenced from each crate with `soroban-sdk = { workspace = true }`. After dependency changes, refresh the lockfile with `cargo update -p <crate>` as needed and verify with `cargo check --workspace`.

## Prerequisites

- Rust stable
- `stellar-cli` installed:

```bash
cargo install --locked stellar-cli
```

## Network configuration

`contract/scripts/deploy.sh` supports:

- `--network futurenet`
  - RPC: `https://rpc-futurenet.stellar.org:443`
  - Passphrase: `Test SDF Future Network ; October 2022`
- `--network testnet`
  - RPC: `https://rpc-testnet.stellar.org:443`
  - Passphrase: `Test SDF Network ; September 2015`
- `--network mainnet`
  - RPC: `https://rpc-mainnet.stellar.org:443`
  - Passphrase: `Public Global Stellar Network ; September 2015`

You can override either value with:

- `--rpc-url <url>`
- `--network-passphrase <passphrase>`

## Funding account setup

The deploy script requires a Stellar identity (`--source`).
CLI state is stored locally in `contract/.stellar` by default (override with `STELLAR_STATE_DIR`).

- Futurenet/testnet:
  - If the identity does not exist, the script generates it.
  - The script funds it automatically (friendbot) unless `--no-fund` is set.
- Mainnet:
  - Auto-generation/funding is disabled.
  - Provide an existing funded source identity.

Useful commands:

```bash
stellar keys generate myfans-deployer --network futurenet --fund
stellar keys public-key myfans-deployer
stellar keys fund myfans-deployer --network testnet
```

## One-command deploy

From repository root:

```bash
./contract/scripts/deploy.sh --network futurenet
```

Deploy to testnet:

```bash
./contract/scripts/deploy.sh --network testnet --source myfans-testnet-deployer
```

The script deploys all five contracts, initializes required contracts, then verifies each one by invoking a view method (`version`, `admin`, `has-access`).

## Output files

By default, deployment outputs are written to:

- `contract/deployed.json`
- `contract/.env.deployed`

Both include contract addresses/IDs and network metadata. `deployed.json` includes a `schemaVersion` field (e.g., `"1.0.0"`) for compatibility. Environment variable names and aliases are documented in [`docs/DEPLOYED_ENV.md`](docs/DEPLOYED_ENV.md).

Override paths with:

- `--out <path>`
- `--env-out <path>`

## CI verification

GitHub Actions `contracts` job now includes:

1. Build (`cargo build --target wasm32-unknown-unknown --release`)
2. Test (`cargo test`)
3. Deploy on Futurenet (`./scripts/deploy.sh --network futurenet ...`)
4. Verify contract responses during deploy

If contract deploy or verification fails, CI fails.

## Non-interactive mode (CI / automation)

Pass `--non-interactive` to disable all interactive prompts and key-generation side-effects.
In this mode the script will **fail immediately** if the source identity does not already exist,
rather than generating one on the fly.

This is the recommended flag for any automated pipeline (GitHub Actions, GitLab CI, etc.).

### Required pre-conditions

Before running the script in non-interactive mode you must:

1. **Create the identity** (once, outside CI):
   ```bash
   stellar keys generate myfans-deployer --network testnet --fund
   ```
2. **Export the secret key** and store it as a CI secret (e.g. `STELLAR_SECRET_KEY`).
3. **Import the key inside the CI job** before calling the deploy script:
   ```bash
   stellar keys add myfans-deployer --secret-key "$STELLAR_SECRET_KEY"
   ```

### Typical CI invocation

```bash
# Dry-run (build + WASM validation only — no transactions):
./contract/scripts/deploy.sh \
  --network testnet \
  --source myfans-deployer \
  --non-interactive \
  --dry-run

# Full deploy (submits transactions):
./contract/scripts/deploy.sh \
  --network testnet \
  --source myfans-deployer \
  --non-interactive \
  --no-fund \
  --out /tmp/deployed.json \
  --env-out /tmp/.env.deployed
```

### GitHub Actions example

```yaml
- name: Import deployer identity
  run: stellar keys add myfans-deployer --secret-key "${{ secrets.STELLAR_SECRET_KEY }}"

- name: Deploy contracts (dry-run)
  run: |
    ./contract/scripts/deploy.sh \
      --network testnet \
      --source myfans-deployer \
      --non-interactive \
      --dry-run
```

### Flag reference

| Flag | Effect |
|------|--------|
| `--non-interactive` | Fail if identity is missing; never prompt or auto-generate |
| `--dry-run` | Build + validate WASM artifacts; skip all on-chain transactions |
| `--no-fund` | Skip friendbot funding (required when account is already funded) |
| `--network` | `futurenet` \| `testnet` \| `mainnet` |
| `--source` | Stellar identity name (must exist when `--non-interactive` is set) |

### Manual checklist

- [ ] `stellar keys public-key myfans-deployer` returns the expected public key
- [ ] `./contract/scripts/deploy.sh --network testnet --non-interactive --dry-run` exits 0
- [ ] `./contract/scripts/deploy.sh --network testnet --non-interactive --no-fund` exits 0 and writes `deployed.json`
- [ ] Removing the identity and re-running with `--non-interactive` exits non-zero with a clear error message
