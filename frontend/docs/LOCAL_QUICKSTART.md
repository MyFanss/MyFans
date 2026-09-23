# Local Quickstart

This guide gets the MyFans frontend running locally against a local contract
and backend.

## Prerequisites

- Node.js 18+
- A running local Soroban/Stellar network (see `contract/README.md`)
- The backend API running locally (see `backend/README.md`)

## 1. Install dependencies

```bash
cd frontend
npm install
```

## 2. Configure environment

Copy the example env file and fill in the values for your local stack:

```bash
cp .env.example .env.local
```

Key variables:

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Base URL of the backend API |
| `NEXT_PUBLIC_CONTRACT_ID` | Deployed subscription contract ID |
| `NEXT_PUBLIC_NETWORK` | `local` / `testnet` / `mainnet` |

## 3. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000.

## Subscription pause (admin incident response)

Subscriptions can be globally paused during incident response. When paused:

- `subscribe`, `extend`, and `create_plan` revert on-chain.
- The backend reports the paused state via its status/ready signal.
- The subscribe UI shows a locked-state banner and disables the confirm CTA.

### Pausing / unpausing locally

Pause and unpause are **admin-only** operations. The admin key is held by the
incident responder and is never exposed to the frontend or committed to the
repo. To exercise the flow locally:

1. Ensure your local admin key is configured for the contract CLI (see
   `contract/AUTH_MATRIX.md` for the authorization matrix).
2. Call the contract's `pause` entrypoint from the admin account to block
   `subscribe`, `extend`, and `create_plan`.
3. Call `unpause` from the same admin account to restore normal operation.

Do not paste admin addresses or keys into the UI, logs, or issue trackers.

### Verifying the locked-state UX

1. Pause the contract as above.
2. Reload the subscribe page. The banner should read that subscriptions are
   temporarily paused and the confirm button should be disabled.
3. If the UI still shows the unlocked state, the cached status is stale —
   refresh, or wait for the next status poll to pick up the paused signal.
4. Unpause and confirm the CTA re-enables.

### Runbook

For the full incident runbook (key ceremony, escalation, and unpause
procedure), see `SECURITY.md`.

## Troubleshooting

- **Confirm CTA stays disabled after unpause**: the frontend may be serving a
  stale cached status. Hard-refresh the page.
- **`subscribe` reverts unexpectedly**: the contract may be paused. Check the
  backend status signal before retrying.
