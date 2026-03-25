# MyFans Soroban Contracts

Smart contracts and deployment automation for MyFans on Stellar/Soroban.

## Contracts deployed by script

1. `myfans-token`
2. `creator-registry`
3. `subscription`
4. `content-access`
5. `earnings`

The deploy script applies this order to keep initialization/dependency flow deterministic.

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

Both include contract addresses/IDs and network metadata.

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
