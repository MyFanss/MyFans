#!/usr/bin/env bash
set -euo pipefail
set -E

on_error() {
  local exit_code=$?
  echo "[deploy] failed at line ${BASH_LINENO[0]}: ${BASH_COMMAND}" >&2
  exit "$exit_code"
}
trap on_error ERR

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STELLAR_STATE_DIR="${STELLAR_STATE_DIR:-$ROOT_DIR/.stellar}"
STELLAR=(stellar)

mkdir -p "$STELLAR_STATE_DIR"
export XDG_CONFIG_HOME="$STELLAR_STATE_DIR"

NETWORK="futurenet"
SOURCE_ACCOUNT="myfans-deployer"
OUTPUT_JSON="$ROOT_DIR/deployed.json"
OUTPUT_ENV="$ROOT_DIR/.env.deployed"
AUTO_FUND="true"
DRY_RUN="false"
NON_INTERACTIVE="false"

usage() {
  cat <<USAGE
Usage: $(basename "$0") [options]

Options:
  --network <futurenet|testnet|mainnet>  Network name (default: futurenet)
  --source <identity>                     Source account identity (default: myfans-deployer)
  --rpc-url <url>                        Override RPC URL
  --network-passphrase <passphrase>      Override network passphrase
  --out <path>                           Output JSON path (default: contract/deployed.json)
  --env-out <path>                       Output env path (default: contract/.env.deployed)
  --no-fund                              Disable auto funding on futurenet/testnet
  --dry-run                              Validate build and config without submitting transactions
  --non-interactive                      CI mode: never prompt; fail if identity is missing
  -h, --help                             Show this help
USAGE
}

RPC_URL=""
NETWORK_PASSPHRASE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --network)
      NETWORK="$2"
      shift 2
      ;;
    --source)
      SOURCE_ACCOUNT="$2"
      shift 2
      ;;
    --rpc-url)
      RPC_URL="$2"
      shift 2
      ;;
    --network-passphrase)
      NETWORK_PASSPHRASE="$2"
      shift 2
      ;;
    --out)
      OUTPUT_JSON="$2"
      shift 2
      ;;
    --env-out)
      OUTPUT_ENV="$2"
      shift 2
      ;;
    --no-fund)
      AUTO_FUND="false"
      shift
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    --non-interactive)
      NON_INTERACTIVE="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

case "$NETWORK" in
  futurenet)
    DEFAULT_RPC_URL="https://rpc-futurenet.stellar.org:443"
    DEFAULT_NETWORK_PASSPHRASE="Test SDF Future Network ; October 2022"
    ;;
  testnet)
    DEFAULT_RPC_URL="https://rpc-testnet.stellar.org:443"
    DEFAULT_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
    ;;
  mainnet)
    DEFAULT_RPC_URL="https://rpc-mainnet.stellar.org:443"
    DEFAULT_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
    ;;
  *)
    echo "Unsupported --network: $NETWORK" >&2
    exit 1
    ;;
esac

RPC_URL="${RPC_URL:-$DEFAULT_RPC_URL}"
NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-$DEFAULT_NETWORK_PASSPHRASE}"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "[deploy] *** DRY-RUN MODE — no transactions will be submitted ***"
fi
if [[ "$NON_INTERACTIVE" == "true" ]]; then
  echo "[deploy] *** NON-INTERACTIVE MODE — identity auto-generation disabled ***"
fi
echo "[deploy] network=$NETWORK"
echo "[deploy] rpc=$RPC_URL"

# ── Issue #2110: verify crate directories exist before any network call ──────
# Every package in PACKAGES must have a crate directory under contracts/.
# Fail fast with a clear message so a missing crate never reaches the network.
PACKAGES=(
  "myfans-token"
  "creator-registry"
  "treasury"
  "subscription"
  "content-access"
  "earnings"
  "creator-earnings"
)

missing_crates=()
for package in "${PACKAGES[@]}"; do
  if [[ ! -d "$ROOT_DIR/contracts/$package" ]]; then
    missing_crates+=("$package")
  fi
done
if [[ ${#missing_crates[@]} -gt 0 ]]; then
  echo "[deploy] ERROR: missing crate directories under contract/contracts/:" >&2
  for package in "${missing_crates[@]}"; do
    echo "[deploy]   - $package (expected $ROOT_DIR/contracts/$package)" >&2
  done
  echo "[deploy] Restore the missing crates or remove them from PACKAGES in deploy.sh and contract/Cargo.toml." >&2
  exit 1
fi

if ! command -v stellar >/dev/null 2>&1; then
  echo "stellar CLI is required. Install: cargo install --locked stellar-cli" >&2
  exit 1
fi

if ! "${STELLAR[@]}" network ls | awk '{print $1}' | grep -qx "$NETWORK"; then
  echo "[deploy] adding network profile '$NETWORK'"
  "${STELLAR[@]}" network add "$NETWORK" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE"
fi

if ! "${STELLAR[@]}" keys public-key "$SOURCE_ACCOUNT" >/dev/null 2>&1; then
  if [[ "$NETWORK" == "mainnet" ]]; then
    echo "Source account '$SOURCE_ACCOUNT' not found and auto-generation on mainnet is disabled." >&2
    exit 1
  fi

  if [[ "$NON_INTERACTIVE" == "true" ]]; then
    echo "[deploy] ERROR: identity '$SOURCE_ACCOUNT' not found and --non-interactive is set." >&2
    echo "[deploy] Pre-create the identity with: stellar keys generate $SOURCE_ACCOUNT --network $NETWORK" >&2
    exit 1
  fi

  echo "[deploy] generating source identity '$SOURCE_ACCOUNT'"
  "${STELLAR[@]}" keys generate "$SOURCE_ACCOUNT" --network "$NETWORK" --rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE"
fi

if [[ "$AUTO_FUND" == "true" && ( "$NETWORK" == "futurenet" || "$NETWORK" == "testnet" ) ]]; then
  echo "[deploy] funding '$SOURCE_ACCOUNT' on $NETWORK"
  "${STELLAR[@]}" keys fund "$SOURCE_ACCOUNT" --network "$NETWORK" --rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE" || true
fi

SOURCE_PUBLIC_KEY="$("${STELLAR[@]}" keys public-key "$SOURCE_ACCOUNT")"
echo "[deploy] source=$SOURCE_PUBLIC_KEY"

echo "[deploy] building contracts"
for package in "${PACKAGES[@]}"; do
  "${STELLAR[@]}" -q contract build --manifest-path "$ROOT_DIR/Cargo.toml" --package "$package"
done

# ── Issue #888: verify_wasm ───────────────────────────────────────────────────
# Checks that a release WASM artifact exists and is a valid WebAssembly binary
# (magic bytes \0asm).  Called unconditionally after every build so CI catches
# a broken myfans-token wasm before any deployment attempt.
verify_wasm() {
  local package="$1"
  local wasm_name="${package//-/_}.wasm"
  local wasm_path
  wasm_path="$(find "$ROOT_DIR/target" -type f -path "*/release/$wasm_name" -print -quit)"

  if [[ -z "$wasm_path" ]]; then
    echo "[deploy] ERROR: WASM not found for package '$package'" >&2
    return 1
  fi

  # Validate WebAssembly magic bytes: 0x00 0x61 0x73 0x6D (\0asm)
  local magic
  magic="$(xxd -p -l 4 "$wasm_path" 2>/dev/null || od -A n -N 4 -t x1 "$wasm_path" | tr -d ' \n')"
  if [[ "$magic" != "0061736d" ]]; then
    echo "[deploy] ERROR: '$wasm_path' is not a valid WASM binary (magic=$magic)" >&2
    return 1
  fi

  echo "[deploy] verified: $wasm_path"
  return 0
}

# ── Dry-run: validate WASM artifacts exist, then exit ────────────────────────
if [[ "$DRY_RUN" == "true" ]]; then
  echo "[deploy] validating WASM artifacts"
  dry_run_ok=true
  for package in "${PACKAGES[@]}"; do
    verify_wasm "$package" || dry_run_ok=false
  done

  if [[ "$dry_run_ok" != "true" ]]; then
    echo "[deploy] dry-run FAILED — missing or invalid WASM artifacts" >&2
    exit 1
  fi

  echo "[deploy] dry-run passed — build and config are valid"
  exit 0
fi

# ── Post-build WASM verification (Issue #888) ─────────────────────────────────
# Always verify all built WASM artifacts after build, even outside dry-run, so
# a corrupted or missing artifact is caught before any on-chain deployment.
echo "[deploy] verifying WASM artifacts"
for package in "${PACKAGES[@]}"; do
  verify_wasm "$package"
done

deploy_contract() {
  local package="$1"
  local wasm_name="${package//-/_}.wasm"
  local wasm_path

  # Avoid pipefail/SIGPIPE issues from `find | head` under `set -euo pipefail`.
  wasm_path="$(find "$ROOT_DIR/target" -type f -path "*/release/$wasm_name" -print -quit)"
  if [[ -z "$wasm_path" ]]; then
    echo "Unable to locate wasm for package '$package' after build." >&2
    exit 1
  fi

  echo "[deploy] deploying $package" >&2
  local contract_id
  contract_id="$("${STELLAR[@]}" contract deploy \
    --wasm "$wasm_path" \
    --source-account "$SOURCE_ACCOUNT" \
    --network "$NETWORK" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE")"

  echo "$contract_id"
}

invoke_contract() {
  local contract_id="$1"
  shift

  "${STELLAR[@]}" contract invoke \
    --id "$contract_id" \
    --source-account "$SOURCE_ACCOUNT" \
    --network "$NETWORK" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- "$@"
}

invoke_contract_view() {
  local contract_id="$1"
  shift

  "${STELLAR[@]}" contract invoke \
    --id "$contract_id" \
    --source-account "$SOURCE_ACCOUNT" \
    --network "$NETWORK" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- "$@"
}

check_method() {
  local contract_id="$1"
  local method="$2"

  echo "[deploy] checking $method on $contract_id" >&2
  invoke_contract_view "$contract_id" "$method" >/dev/null
}

# ── Issue #2110: check_method names must exist on each contract ──────────────
# token:        admin, balance, total_supply
# treasury:     admin, get_balance
# subscription: get_config, is_paused
# creator-registry: get_creator
# content-access:    get_price
# earnings:          get_balance
# creator-earnings:  get_balance

TOKEN_ID="$(deploy_contract myfans-token)"
check_method "$TOKEN_ID" admin
check_method "$TOKEN_ID" balance
check_method "$TOKEN_ID" total_supply

CREATOR_REGISTRY_ID="$(deploy_contract creator-registry)"
check_method "$CREATOR_REGISTRY_ID" get_creator

TREASURY_ID="$(deploy_contract treasury)"
check_method "$TREASURY_ID" admin
check_method "$TREASURY_ID" get_balance

SUBSCRIPTION_ID="$(deploy_contract subscription)"
check_method "$SUBSCRIPTION_ID" get_config
check_method "$SUBSCRIPTION_ID" is_paused

CONTENT_ACCESS_ID="$(deploy_contract content-access)"
check_method "$CONTENT_ACCESS_ID" get_price

EARNINGS_ID="$(deploy_contract earnings)"
check_method "$EARNINGS_ID" get_balance

CREATOR_EARNINGS_ID="$(deploy_contract creator-earnings)"
check_method "$CREATOR_EARNINGS_ID" get_balance

cat > "$OUTPUT_JSON" <<JSON
{
  "network": "$NETWORK",
  "source": "$SOURCE_PUBLIC_KEY",
  "contracts": {
    "myfans-token": "$TOKEN_ID",
    "creator-registry": "$CREATOR_REGISTRY_ID",
    "treasury": "$TREASURY_ID",
    "subscription": "$SUBSCRIPTION_ID",
    "content-access": "$CONTENT_ACCESS_ID",
    "earnings": "$EARNINGS_ID",
    "creator-earnings": "$CREATOR_EARNINGS_ID"
  }
}
JSON

cat > "$OUTPUT_ENV" <<ENV
MYFANS_TOKEN_CONTRACT_ID=$TOKEN_ID
CREATOR_REGISTRY_CONTRACT_ID=$CREATOR_REGISTRY_ID
TREASURY_CONTRACT_ID=$TREASURY_ID
SUBSCRIPTION_CONTRACT_ID=$SUBSCRIPTION_ID
CONTENT_ACCESS_CONTRACT_ID=$CONTENT_ACCESS_ID
EARNINGS_CONTRACT_ID=$EARNINGS_ID
CREATOR_EARNINGS_CONTRACT_ID=$CREATOR_EARNINGS_ID
ENV

echo "[deploy] wrote $OUTPUT_JSON and $OUTPUT_ENV"
