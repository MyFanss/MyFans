#!/usr/bin/env bash
# MyFans — end-to-end testnet proof path (issue #1858).
#
#   create plan → subscribe → gated access granted → cancel → access revoked
#
# Uses THROWAWAY accounts only: a creator, a fan, and an outsider are generated
# in a temporary keystore, funded by friendbot, and discarded at the end. No
# existing identity or admin key is read or needed.
#
# Required:
#   SUBSCRIPTION_CONTRACT_ID   Deployed + initialised subscription contract
#                              (CONTRACT_ID_SUBSCRIPTION is accepted as an alias)
# Optional:
#   STELLAR_RPC_URL            default: https://soroban-testnet.stellar.org
#   STELLAR_NETWORK_PASSPHRASE default: Test SDF Network ; September 2015
#   FRIENDBOT_URL              default: https://friendbot.stellar.org
#   PLAN_AMOUNT                stroops per period (default: 10000000 = 1 XLM)
#   PLAN_INTERVAL              ledgers per period (default: 17280 ≈ 1 day)
#   EVIDENCE_DIR               default: ./e2e-evidence/<UTC timestamp>
#   API_URL + API_CREATOR_ID   If both set, also assert the backend never ships
#                              contentCid to an unauthenticated viewer
#   API_ACCESS_PATH            default: /creators/{id}/access
#
# Exit codes:
#   0   path verified
#   1   assertion failed — a real product bug; investigate
#   2   configuration / tooling error
#   10  INCONCLUSIVE: friendbot (faucet) or RPC unavailable — retry later
#   11  INCONCLUSIVE: contract paused or not initialised
#   12  INCONCLUSIVE: contract Wasm changed mid-run (upgrade) — rerun

set -euo pipefail

RPC_URL="${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}"
PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
FRIENDBOT_URL="${FRIENDBOT_URL:-https://friendbot.stellar.org}"
CONTRACT_ID="${SUBSCRIPTION_CONTRACT_ID:-${CONTRACT_ID_SUBSCRIPTION:-}}"
PLAN_AMOUNT="${PLAN_AMOUNT:-10000000}"
PLAN_INTERVAL="${PLAN_INTERVAL:-17280}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
EVIDENCE_DIR="${EVIDENCE_DIR:-./e2e-evidence/$STAMP}"
API_ACCESS_PATH="${API_ACCESS_PATH:-/creators/{id}/access}"

log() { echo "[e2e-testnet] $*" >&2; }
fail() { log "FAIL: $*"; evidence "| **Result** | **FAIL:** $* |"; exit 1; }
inconclusive() { log "INCONCLUSIVE: $2"; evidence "| **Result** | **INCONCLUSIVE:** $2 |"; exit "$1"; }
evidence() { [[ -n "${EVIDENCE_FILE:-}" ]] && echo "$*" >>"$EVIDENCE_FILE"; return 0; }

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
  else shasum -a 256 "$1" | awk '{print $1}'; fi
}

# ── Preflight ────────────────────────────────────────────────────────────
command -v stellar >/dev/null || { log "stellar-cli not found (cargo install --locked stellar-cli)"; exit 2; }
command -v curl >/dev/null || { log "curl not found"; exit 2; }
[[ -n "$CONTRACT_ID" ]] || { log "SUBSCRIPTION_CONTRACT_ID is required"; exit 2; }
[[ "$CONTRACT_ID" =~ ^C[A-Z2-7]{55}$ ]] || { log "SUBSCRIPTION_CONTRACT_ID does not look like a contract id"; exit 2; }
[[ "$PASSPHRASE" != *"Public Global Stellar Network"* ]] || { log "Refusing to run against mainnet"; exit 2; }

mkdir -p "$EVIDENCE_DIR"
EVIDENCE_FILE="$EVIDENCE_DIR/evidence.md"
LOG_FILE="$EVIDENCE_DIR/cli.log"
: >"$LOG_FILE"

# Isolated keystore: throwaway keys never touch the operator's identities.
KEYSTORE="$(mktemp -d "${TMPDIR:-/tmp}/myfans-e2e-keys.XXXXXX")"
chmod 700 "$KEYSTORE"
trap 'rm -rf "$KEYSTORE"' EXIT
export XDG_CONFIG_HOME="$KEYSTORE"

net=(--rpc-url "$RPC_URL" --network-passphrase "$PASSPHRASE")

cat >"$EVIDENCE_FILE" <<EOF
# E2E testnet path — evidence

| Field | Value |
|---|---|
| Run (UTC) | $STAMP |
| Operator | ${GITHUB_ACTOR:-${USER:-unknown}} |
| Git commit | $(git rev-parse --short HEAD 2>/dev/null || echo n/a) |
| stellar-cli | $(stellar --version | head -1) |
| RPC | $RPC_URL |
| Subscription contract | \`$CONTRACT_ID\` |
EOF

log "Preflight: RPC health"
health="$(curl -fsS -m 20 -X POST -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' "$RPC_URL" 2>>"$LOG_FILE" || true)"
[[ "$health" == *'"healthy"'* ]] || inconclusive 10 "Soroban RPC unhealthy or unreachable: ${health:-no response}"

# Invoke helper: logs the command + output, prints the trimmed return value.
invoke() {
  local source="$1"; shift
  local out
  echo "\$ invoke --source $source -- $*" >>"$LOG_FILE"
  if ! out="$(stellar contract invoke --id "$CONTRACT_ID" --source "$source" "${net[@]}" -- "$@" 2>>"$LOG_FILE")"; then
    echo "(failed)" >>"$LOG_FILE"
    return 1
  fi
  echo "$out" >>"$LOG_FILE"
  printf '%s' "$out" | tail -n1 | tr -d '"[:space:]'
}

wasm_hash() {
  local f="$KEYSTORE/contract.wasm"
  stellar contract fetch --id "$CONTRACT_ID" "${net[@]}" --out-file "$f" 2>>"$LOG_FILE" || return 1
  sha256 "$f"
}

log "Preflight: contract Wasm + config"
if ! WASM_BEFORE="$(wasm_hash)"; then
  if grep -qi "contract not found" "$LOG_FILE"; then
    log "Contract $CONTRACT_ID does not exist on this network"
    evidence "| **Result** | **CONFIG ERROR:** contract not found |"
    exit 2
  fi
  inconclusive 10 "Could not fetch contract Wasm (RPC issue)"
fi
evidence "| Wasm sha256 (start) | \`$WASM_BEFORE\` |"

# ── Throwaway accounts ───────────────────────────────────────────────────
fund() {
  local addr="$1" attempt code
  for attempt in 1 2 3; do
    code="$(curl -s -o /dev/null -w '%{http_code}' -m 30 "$FRIENDBOT_URL/?addr=$addr" || echo 000)"
    # 200 = funded; 400 = already funded (fine on retries)
    [[ "$code" == 200 || "$code" == 400 ]] && return 0
    log "friendbot attempt $attempt for $addr returned $code; retrying"
    sleep $((attempt * 5))
  done
  return 1
}

declare -a ROLES=(creator fan outsider)
for role in "${ROLES[@]}"; do
  stellar keys generate "e2e-$role" >>"$LOG_FILE" 2>&1 \
    || { log "stellar keys generate failed"; exit 2; }
done
CREATOR="$(stellar keys address e2e-creator)"
FAN="$(stellar keys address e2e-fan)"
OUTSIDER="$(stellar keys address e2e-outsider)"
evidence "| Creator (throwaway) | \`$CREATOR\` |"
evidence "| Fan (throwaway) | \`$FAN\` |"
evidence "| Outsider (throwaway) | \`$OUTSIDER\` |"

log "Funding throwaway accounts via friendbot"
for addr in "$CREATOR" "$FAN" "$OUTSIDER"; do
  fund "$addr" || inconclusive 10 "Friendbot could not fund $addr (faucet empty or rate-limited)"
done

config="$(invoke e2e-outsider get_config)" \
  || inconclusive 11 "get_config reverted — contract not initialised?"
if [[ "$config" == *'"paused":true'* || "$config" == *'paused:true'* ]]; then
  inconclusive 11 "Contract is paused"
fi

NATIVE_SAC="$(stellar contract id asset --asset native "${net[@]}" 2>>"$LOG_FILE")" \
  || { log "Could not resolve native XLM SAC id"; exit 2; }
evidence "| Plan asset (native XLM SAC) | \`$NATIVE_SAC\` |"
evidence ""
evidence "| Step | Expected | Actual | Result |"
evidence "|---|---|---|---|"

step() { evidence "| $1 | $2 | $3 | $4 |"; }

# ── 1. Creator creates a plan ────────────────────────────────────────────
log "1. create_plan"
PLAN_ID="$(invoke e2e-creator create_plan --creator "$CREATOR" --asset "$NATIVE_SAC" \
  --amount "$PLAN_AMOUNT" --interval "$PLAN_INTERVAL")" || fail "create_plan reverted"
[[ "$PLAN_ID" =~ ^[0-9]+$ ]] || fail "create_plan returned unexpected value: $PLAN_ID"
step "1. create_plan" "plan id" "$PLAN_ID" "✅"

plan="$(invoke e2e-outsider get_plan --plan_id "$PLAN_ID")" || fail "get_plan reverted for new plan"
[[ "$plan" == *"$CREATOR"* ]] || fail "get_plan does not reference the creator"
step "1b. get_plan" "creator = throwaway creator" "match" "✅"

# ── 2. Gated before subscribing ──────────────────────────────────────────
log "2. is_subscriber before subscribe"
r="$(invoke e2e-outsider is_subscriber --fan "$FAN" --creator "$CREATOR")" || fail "is_subscriber reverted"
[[ "$r" == false ]] || fail "fan has access before subscribing ($r)"
step "2. is_subscriber(fan) before subscribe" "false" "$r" "✅"

# ── 3. Fan subscribes (pays) ─────────────────────────────────────────────
log "3. subscribe"
invoke e2e-fan subscribe --fan "$FAN" --plan_id "$PLAN_ID" >/dev/null || fail "subscribe reverted"
step "3. subscribe" "success" "success" "✅"

# ── 4. Access granted to the fan, not to others ──────────────────────────
log "4. is_subscriber after subscribe"
r="$(invoke e2e-outsider is_subscriber --fan "$FAN" --creator "$CREATOR")" || fail "is_subscriber reverted"
[[ "$r" == true ]] || fail "fan does not have access after subscribing ($r)"
step "4. is_subscriber(fan) after subscribe" "true" "$r" "✅"

r="$(invoke e2e-outsider is_subscriber --fan "$OUTSIDER" --creator "$CREATOR")" || fail "is_subscriber reverted"
[[ "$r" == false ]] || fail "outsider has access without subscribing ($r)"
step "4b. is_subscriber(outsider)" "false" "$r" "✅"

# ── 5. Backend never leaks gated content to anonymous viewers (optional) ─
if [[ -n "${API_URL:-}" && -n "${API_CREATOR_ID:-}" ]]; then
  log "5. backend anonymous access check"
  url="${API_URL%/}${API_ACCESS_PATH//\{id\}/$API_CREATOR_ID}"
  body="$(curl -fsS -m 20 "$url" 2>>"$LOG_FILE")" || fail "GET $url failed"
  echo "GET $url -> $body" >>"$LOG_FILE"
  [[ "$body" == *'"contentCid":null'* ]] || fail "anonymous viewer received a contentCid from $url"
  step "5. GET access (anonymous)" "contentCid null" "null" "✅"
else
  step "5. GET access (anonymous)" "—" "skipped (API_URL/API_CREATOR_ID unset)" "⏭"
fi

# ── 6. Cancel revokes access ─────────────────────────────────────────────
log "6. cancel"
invoke e2e-fan cancel --fan "$FAN" --creator "$CREATOR" >/dev/null || fail "cancel reverted"
r="$(invoke e2e-outsider is_subscriber --fan "$FAN" --creator "$CREATOR")" || fail "is_subscriber reverted"
[[ "$r" == false ]] || fail "fan still has access after cancel ($r)"
step "6. cancel → is_subscriber(fan)" "false" "$r" "✅"

# ── Upgrade guard ────────────────────────────────────────────────────────
WASM_AFTER="$(wasm_hash)" || inconclusive 10 "Could not re-fetch contract Wasm"
evidence ""
evidence "| Field | Value |"
evidence "|---|---|"
evidence "| Wasm sha256 (end) | \`$WASM_AFTER\` |"
[[ "$WASM_BEFORE" == "$WASM_AFTER" ]] || inconclusive 12 "Contract Wasm changed during the run (upgrade mid-path); rerun"

tx_hashes="$(grep -oE '\b[0-9a-f]{64}\b' "$LOG_FILE" | grep -v "$WASM_BEFORE" | sort -u | head -20 | tr '\n' ' ' || true)"
[[ -n "$tx_hashes" ]] && evidence "| Tx / hash references in CLI log | ${tx_hashes% } |"
evidence "| **Result** | **PASS** |"

log "PASS — evidence in $EVIDENCE_FILE"
