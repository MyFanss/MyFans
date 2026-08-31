# `.env.deployed*` environment variables

Files such as `contract/.env.deployed` or `contract/.env.deployed-ci-<matrix>` are produced by [`scripts/deploy.sh`](../scripts/deploy.sh). They are **not** committed (see repo `.gitignore`).

## Stellar connection

| Variable | Description |
|----------|-------------|
| `STELLAR_NETWORK` | `futurenet`, `testnet`, or `mainnet` |
| `STELLAR_RPC_URL` | Soroban RPC URL used for the deploy |
| `STELLAR_NETWORK_PASSPHRASE` | Network passphrase |
| `STELLAR_SOURCE_ACCOUNT` | Public key of the deployer identity |

## Contract IDs — canonical names (preferred)

Use these in **backend** `.env` when copying from a deploy output:

| Variable | Contract |
|----------|----------|
| `CONTRACT_ID_MYFANS_TOKEN` | MyFans token |
| `CONTRACT_ID_CREATOR_REGISTRY` | Creator registry |
| `CONTRACT_ID_SUBSCRIPTION` | Subscription (singular) |
| `CONTRACT_ID_CONTENT_ACCESS` | Content access |
| `CONTRACT_ID_EARNINGS` | Earnings |

Optional, for flows that still expect a separate “main” app contract id:

| Variable | Notes |
|----------|--------|
| `CONTRACT_ID_MYFANS` | Not set by default deploy; add manually if your stack requires it |

## Aliases (transition)

The same values are repeated under legacy names so existing scripts and env files keep working:

| Alias | Same as |
|-------|---------|
| `TOKEN_CONTRACT_ID` | `CONTRACT_ID_MYFANS_TOKEN` |
| `CREATOR_REGISTRY_CONTRACT_ID` | `CONTRACT_ID_CREATOR_REGISTRY` |
| `SUBSCRIPTIONS_CONTRACT_ID` | `CONTRACT_ID_SUBSCRIPTION` |
| `CONTRACT_ID_SUBSCRIPTIONS` | `CONTRACT_ID_SUBSCRIPTION` |
| `SUBSCRIPTION_CONTRACT_ID` | `CONTRACT_ID_SUBSCRIPTION` |
| `CONTENT_ACCESS_CONTRACT_ID` | `CONTRACT_ID_CONTENT_ACCESS` |
| `EARNINGS_CONTRACT_ID` | `CONTRACT_ID_EARNINGS` |

Backend loaders resolve **canonical names first** in code where order matters; deploy output sets both canonical and alias lines.

## Frontend (Next.js)

Browser code uses `NEXT_PUBLIC_*` keys. Map from canonical backend names by prefix:

| Backend / deploy (canonical) | Frontend |
|-----------------------------|----------|
| `CONTRACT_ID_MYFANS_TOKEN` | `NEXT_PUBLIC_MYFANS_TOKEN_CONTRACT_ID` (or `NEXT_PUBLIC_PLAN_TOKEN_CONTRACT_ID`) |
| `CONTRACT_ID_CREATOR_REGISTRY` | `NEXT_PUBLIC_CREATOR_REGISTRY_CONTRACT_ID` |
| `CONTRACT_ID_SUBSCRIPTION` | `NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ID` (alias: `NEXT_PUBLIC_SUBSCRIPTIONS_CONTRACT_ID`) |
| `CONTRACT_ID_CONTENT_ACCESS` | `NEXT_PUBLIC_CONTENT_ACCESS_CONTRACT_ID` |
| `CONTRACT_ID_EARNINGS` | `NEXT_PUBLIC_EARNINGS_CONTRACT_ID` |

See `frontend/src/lib/contract-config.ts` for the exact lookup order.

## Backend resolution

- **Contract health / `loadContractIds()`** — `backend/src/contract-health/contract-ids.loader.ts` (env, then `CONTRACT_IDS_PATH`, then deploy JSON). Env parsing uses `backend/src/common/contract-deployed-env.ts`.
- **Subscription chain reads / poller** — subscription id from `CONTRACT_ID_SUBSCRIPTION` and the aliases above, then optional fallback `CONTRACT_ID_MYFANS` where documented in code.
