# Contract Deploy Runbook

Step-by-step procedures for deploying, verifying, and rolling back MyFans Soroban contracts on Stellar.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [One-time identity setup](#2-one-time-identity-setup)
3. [Build and validate WASM artifacts](#3-build-and-validate-wasm-artifacts)
4. [Deploy to testnet](#4-deploy-to-testnet)
5. [Deploy to mainnet](#5-deploy-to-mainnet)
6. [Post-deploy verification](#6-post-deploy-verification)
7. [Wire contract IDs into the backend and frontend](#7-wire-contract-ids-into-the-backend-and-frontend)
8. [Rollback procedure](#8-rollback-procedure)
9. [CI dry-run (non-interactive)](#9-ci-dry-run-non-interactive)
10. [Troubleshooting](#10-troubleshooting)
11. [Checklist](#11-checklist)

---

## 1. Prerequisites

| Tool | Minimum version | Install |
|------|----------------|---------|
| Rust (stable) | 1.75+ | `rustup update stable` |
| `wasm32-unknown-unknown` target | — | `rustup target add wasm32-unknown-unknown` |
| `stellar-cli` | latest stable | `cargo install --locked stellar-cli` |
| `xxd` or `od` | any | pre-installed on Linux/macOS |
| Node.js | 18+ | for backend env wiring |

Verify:

```bash
stellar --version
rustc --version
rustup target list --installed | grep wasm32
```

---

## 2. One-time identity setup

The deploy script requires a named Stellar identity (`--source`). Create it once per machine/environment.

### Testnet / futurenet

```bash
# Generate a new key pair and fund it via friendbot
stellar keys generate myfans-deployer --network testnet --fund

# Confirm the public key
stellar keys public-key myfans-deployer
```

### Mainnet

Auto-generation and friendbot funding are disabled on mainnet. You must supply a pre-funded account.

```bash
# Import an existing secret key
stellar keys add myfans-deployer-mainnet --secret-key "<SECRET_KEY>"

# Confirm
stellar keys public-key myfans-deployer-mainnet
```

> **Security:** Never commit secret keys. Store them in your CI secret manager (e.g. GitHub Actions secrets, AWS Secrets Manager) and import them at deploy time.

### CI / non-interactive environments

```bash
# In the CI job, import the key from a secret before calling the deploy script
stellar keys add myfans-deployer --secret-key "$STELLAR_SECRET_KEY"
```

---

## 3. Build and validate WASM artifacts

Always build and validate before deploying. The `--dry-run` flag does this without submitting any transactions.

```bash
# From repository root
./contract/scripts/deploy.sh \
  --network testnet \
  --source myfans-deployer \
  --dry-run
```

Expected output:

```
[deploy] *** DRY-RUN MODE — no transactions will be submitted ***
[deploy] network=testnet
[deploy] building contracts
[deploy] validating WASM artifacts
[deploy] verified: target/wasm32-unknown-unknown/release/myfans_token.wasm
[deploy] verified: target/wasm32-unknown-unknown/release/creator_registry.wasm
[deploy] verified: target/wasm32-unknown-unknown/release/subscription.wasm
[deploy] verified: target/wasm32-unknown-unknown/release/content_access.wasm
[deploy] verified: target/wasm32-unknown-unknown/release/earnings.wasm
[deploy] dry-run passed — build and config are valid
```

If any artifact is missing or invalid the script exits non-zero with a clear error.

---

## 4. Deploy to testnet

```bash
./contract/scripts/deploy.sh \
  --network testnet \
  --source myfans-deployer \
  --no-fund \
  --out contract/deployed-testnet.json \
  --env-out contract/.env.deployed-testnet
```

The script:

1. Adds the `testnet` network profile to the local stellar CLI config (idempotent).
2. Builds all five contracts (`myfans-token`, `creator-registry`, `subscription`, `content-access`, `earnings`).
3. Verifies each WASM binary (magic bytes check).
4. Deploys contracts in dependency order (token first, then registry, then subscription/content-access which depend on token, then earnings).
5. Initializes each contract with the deployer as admin.
6. Runs smoke tests (view calls) to confirm each contract responds correctly.
7. Writes `deployed-testnet.json` and `.env.deployed-testnet`.

### Output files

| File | Contents |
|------|----------|
| `contract/deployed-testnet.json` | Contract IDs, network metadata, smoke-test results |
| `contract/.env.deployed-testnet` | Shell-sourceable env vars for backend/frontend wiring |

Both files are gitignored. Copy the relevant values into your environment's secret manager or `.env` files.

### Write the canonical `contract-ids.json`

Release smoke reads `contract/contract-ids.json` and **fails closed** when any ID is empty or missing. After a successful testnet deploy, materialize the canonical ID file from the deploy output:

```bash
source contract/.env.deployed-testnet

cat > contract/contract-ids.json <<JSON
{
  "network": "${STELLAR_NETWORK}",
  "rpcUrl": "${STELLAR_RPC_URL}",
  "contracts": {
    "myfansToken": "${CONTRACT_ID_MYFANS_TOKEN}",
    "creatorRegistry": "${CONTRACT_ID_CREATOR_REGISTRY}",
    "subscription": "${CONTRACT_ID_SUBSCRIPTION}",
    "contentAccess": "${CONTRACT_ID_CONTENT_ACCESS}",
    "earnings": "${CONTRACT_ID_EARNINGS}"
  }
}
JSON
```

Validate the file before committing it (this is the same check release smoke runs):

```bash
./contract/scripts/test-deploy-output.sh contract/contract-ids.json
```

A non-zero exit means at least one ID is empty, malformed, or the `network` field does not match the expected network — fix the deploy output and regenerate before proceeding. Never hand-edit IDs; always regenerate from a real deploy so the file cannot drift from the chain.

---

## 5. Deploy to mainnet

> ⚠️ **Mainnet deploys are irreversible.** Always run a full testnet deploy and verification first.

```bash
./contract/scripts/deploy.sh \
  --network mainnet \
  --source myfans-deployer-mainnet \
  --non-interactive \
  --no-fund \
  --out contract/deployed-mainnet.json \
  --env-out contract/.env.deployed-mainnet
```

Additional mainnet precautions:

- Confirm the deployer account has sufficient XLM for all deploy + init transactions (estimate ~5–10 XLM per contract).
- Use `--non-interactive` to prevent any interactive prompts in production pipelines.
- Record the output JSON in a secure artifact store immediately after deploy.
- Regenerate `contract/contract-ids.json` with `"network": "mainnet"` and re-run `./contract/scripts/test-deploy-output.sh contract/contract-ids.json`. A testnet ID file committed against a mainnet env (or vice versa) must fail the network-match check.

---

## 6. Post-deploy verification

The deploy script runs smoke tests automatically. You can also verify manually:

```bash
# Source the deployed env
source contract/.env.deployed-testnet

# Check token admin
stellar contract invoke \
  --id "$CONTRACT_ID_MYFANS_TOKEN" \
  --network testnet \
  --source myfans-deployer \
  --send no \
  -- admin

# Check subscription is not paused
stellar contract invoke \
  --id "$CONTRACT_ID_SUBSCRIPTION" \
  --network testnet \
  --source myfans-deployer \
  --send no \
  -- is-paused

# Check content-access has-access (should return false for a new account)
stellar contract invoke \
  --id "$CONTRACT_ID_CONTENT_ACCESS" \
  --network testnet \
  --source myfans-deployer \
  --send no \
  -- has-access \
  --buyer "$(stellar keys public-key myfans-deployer)" \
  --creator "$(stellar keys public-key myfans-deployer)" \
  --content-id 1

# Check earnings admin
stellar contract invoke \
  --id "$CONTRACT_ID_EARNINGS" \
  --network testnet \
  --source myfans-deployer \
  --send no \
  -- admin
```

All commands should return without error. `is-paused` should return `false`; `has-access` should return `false`.

---

## 7. Wire contract IDs into the backend and frontend

After a successful deploy, copy the contract IDs from the output env file into your application environments.

### Backend

```bash
# Copy canonical IDs from the deploy output
source contract/.env.deployed-testnet

# Add to backend/.env (or your secret manager)
echo "CONTRACT_ID_MYFANS_TOKEN=$CONTRACT_ID_MYFANS_TOKEN" >> backend/.env
echo "CONTRACT_ID_CREATOR_REGISTRY=$CONTRACT_ID_CREATOR_REGISTRY" >> backend/.env
echo "CONTRACT_ID_SUBSCRIPTION=$CONTRACT_ID_SUBSCRIPTION" >> backend/.env
echo "CONTRACT_ID_CONTENT_ACCESS=$CONTRACT_ID_CONTENT_ACCESS" >> backend/.env
echo "CONTRACT_ID_EARNINGS=$CONTRACT_ID_EARNINGS" >> backend/.env
echo "STELLAR_NETWORK=$STELLAR_NETWORK" >> backend/.env
echo "SOROBAN_RPC_URL=$STELLAR_RPC_URL" >> backend/.env
```

See [`contract/docs/DEPLOYED_ENV.md`](./DEPLOYED_ENV.md) for the full variable reference and legacy alias mapping.

### Frontend

```bash
source contract/.env.deployed-testnet

echo "NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ID=$CONTRACT_ID_SUBSCRIPTION" >> frontend/.env.local
echo "NEXT_PUBLIC_MYFANS_TOKEN_CONTRACT_ID=$CONTRACT_ID_MYFANS_TOKEN" >> frontend/.env.local
echo "NEXT_PUBLIC_CREATOR_REGISTRY_CONTRACT_ID=$CONTRACT_ID_CREATOR_REGISTRY" >> frontend/.env.local
echo "NEXT_PUBLIC_CONTENT_ACCESS_CONTRACT_ID=$CONTRACT_ID_CONTENT_ACCESS" >> frontend/.env.local
echo "NEXT_PUBLIC_EARNINGS_CONTRACT_ID=$CONTRACT_ID_EARNINGS" >> frontend/.env.local
echo "NEXT_PUBLIC_STELLAR_NETWORK=$STELLAR_NETWORK" >> frontend/.env.local
```

---

## 8. Rollback procedure

Soroban contracts are immutable once deployed — you cannot modify or delete a deployed contract. "Rollback" means deploying a new version and up

/* … truncated 4585 chars — edit only what you need near the top … */
