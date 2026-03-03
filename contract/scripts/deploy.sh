#!/usr/bin/env bash
set -euo pipefail

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

echo "[deploy] network=$NETWORK"
echo "[deploy] rpc=$RPC_URL"

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
PACKAGES=(
  "myfans-token"
  "creator-registry"
  "subscription"
  "content-access"
  "earnings"
)

for package in "${PACKAGES[@]}"; do
  "${STELLAR[@]}" -q contract build --manifest-path "$ROOT_DIR/Cargo.toml" --package "$package"
done

deploy_contract() {
  local package="$1"
  local wasm_name="${package//-/_}.wasm"
  local wasm_path

  wasm_path="$(find "$ROOT_DIR/target" -type f -path "*/release/$wasm_name" | head -n1 || true)"
  if [[ -z "$wasm_path" ]]; then
    echo "Unable to locate wasm for package '$package' after build." >&2
    exit 1
  fi

  echo "[deploy] deploying $package"
  local contract_id
  contract_id="$("${STELLAR[@]}" -q contract deploy \
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

  "${STELLAR[@]}" -q contract invoke \
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

  "${STELLAR[@]}" -q contract invoke \
    --id "$contract_id" \
    --source-account "$SOURCE_ACCOUNT" \
    --network "$NETWORK" \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    --send no \
    -- "$@"
}

TOKEN_ID="$(deploy_contract "myfans-token")"
CREATOR_REGISTRY_ID="$(deploy_contract "creator-registry")"
SUBSCRIPTION_ID="$(deploy_contract "subscription")"
CONTENT_ACCESS_ID="$(deploy_contract "content-access")"
EARNINGS_ID="$(deploy_contract "earnings")"

# Initialize contracts that expose admin-based views.
invoke_contract "$CREATOR_REGISTRY_ID" init --admin "$SOURCE_PUBLIC_KEY" >/dev/null
invoke_contract "$SUBSCRIPTION_ID" init --admin "$SOURCE_PUBLIC_KEY" --fee-bps 0 --fee-recipient "$SOURCE_PUBLIC_KEY" >/dev/null
invoke_contract "$EARNINGS_ID" init --admin "$SOURCE_PUBLIC_KEY" >/dev/null

# Verify each deployed contract responds.
TOKEN_VERIFY="$(invoke_contract_view "$TOKEN_ID" version)"
CREATOR_REGISTRY_VERIFY="$(invoke_contract_view "$CREATOR_REGISTRY_ID" admin)"
SUBSCRIPTION_VERIFY="$(invoke_contract_view "$SUBSCRIPTION_ID" admin)"
CONTENT_ACCESS_VERIFY="$(invoke_contract_view "$CONTENT_ACCESS_ID" has-access --buyer "$SOURCE_PUBLIC_KEY" --creator "$SOURCE_PUBLIC_KEY" --content-id 1)"
EARNINGS_VERIFY="$(invoke_contract_view "$EARNINGS_ID" admin)"

mkdir -p "$(dirname "$OUTPUT_JSON")" "$(dirname "$OUTPUT_ENV")"

cat > "$OUTPUT_JSON" <<JSON
{
  "network": "$NETWORK",
  "rpcUrl": "$RPC_URL",
  "networkPassphrase": "$NETWORK_PASSPHRASE",
  "sourceAccount": "$SOURCE_PUBLIC_KEY",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "contracts": {
    "token": "$TOKEN_ID",
    "creatorRegistry": "$CREATOR_REGISTRY_ID",
    "subscriptions": "$SUBSCRIPTION_ID",
    "contentAccess": "$CONTENT_ACCESS_ID",
    "earnings": "$EARNINGS_ID"
  },
  "verification": {
    "tokenVersion": "$TOKEN_VERIFY",
    "creatorRegistryAdmin": "$CREATOR_REGISTRY_VERIFY",
    "subscriptionsAdmin": "$SUBSCRIPTION_VERIFY",
    "contentAccessHasAccess": "$CONTENT_ACCESS_VERIFY",
    "earningsAdmin": "$EARNINGS_VERIFY"
  }
}
JSON

cat > "$OUTPUT_ENV" <<ENV
STELLAR_NETWORK=$NETWORK
STELLAR_RPC_URL=$RPC_URL
STELLAR_NETWORK_PASSPHRASE=$NETWORK_PASSPHRASE
STELLAR_SOURCE_ACCOUNT=$SOURCE_PUBLIC_KEY
TOKEN_CONTRACT_ID=$TOKEN_ID
CREATOR_REGISTRY_CONTRACT_ID=$CREATOR_REGISTRY_ID
SUBSCRIPTIONS_CONTRACT_ID=$SUBSCRIPTION_ID
CONTENT_ACCESS_CONTRACT_ID=$CONTENT_ACCESS_ID
EARNINGS_CONTRACT_ID=$EARNINGS_ID
ENV

echo "[deploy] wrote $OUTPUT_JSON"
echo "[deploy] wrote $OUTPUT_ENV"
echo "[deploy] verification passed"
