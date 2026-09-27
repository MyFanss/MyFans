# QUICKSTART — Clone to Subscribe on Testnet (First Hour)

This is the single canonical first-hour guide for running the project locally against **Stellar testnet** and completing a subscription. It consolidates the previously fragmented `frontend/docs/LOCAL_QUICKSTART.md`, `WALLET_SETUP`, and `README` instructions.

> **Testnet only.** Never put mainnet keys, secrets, or funded mainnet accounts in this repo or in these docs.

---

## 1. Wallet support matrix (honest)

| Wallet | Status | Notes |
| --- | --- | --- |
| **Freighter** | ✅ Supported (testnet) | The only wallet we test end-to-end. Use this for the first-hour path. |
| Other Stellar wallets | ⚠️ Unsupported | May work in theory, but we do not test or support them. Do not file first-hour bugs against them. |
| Hardware wallets | ❌ Not supported | Out of scope for local testnet dev. |

If you do not have Freighter installed, install the browser extension and switch it to **Testnet** before continuing. Missing Freighter is the most common first-hour failure.

---

## 2. Prerequisites

- Node.js 20+ and npm
- Docker + Docker Compose
- Git
- [Freighter](https://www.freighter.app/) browser extension, set to **Testnet**

---

## 3. Clone and configure

```bash
git clone <repo-url>
cd <repo>
```

Copy the example env files and fill in the values below.

### Backend environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `STELLAR_NETWORK` | yes | Set to `testnet`. |
| `STELLAR_RPC_URL` | yes | Testnet Soroban RPC endpoint. |
| `STELLAR_HORIZON_URL` | yes | Testnet Horizon endpoint. |
| `CONTRACT_ID` | yes | Deployed contract id (see below). |
| `DATABASE_URL` | yes | Postgres connection string (compose provides one). |

### Frontend environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_STELLAR_NETWORK` | yes | Set to `testnet`. |
| `VITE_CONTRACT_ID` | yes | Must match the backend `CONTRACT_ID`. |
| `VITE_RPC_URL` | yes | Testnet Soroban RPC endpoint. |

### Where contract ids come from

Contract ids are produced when the contracts are deployed to testnet. If you have not deployed yet, run the deploy script (see `backend/scripts/`) and copy the resulting id into **both** `CONTRACT_ID` and `VITE_CONTRACT_ID`.

**If a contract id is empty or missing**, the app will fail to load contract state and subscriptions will not work. Do not proceed until both values are set and identical. An empty contract id is the second most common first-hour failure.

---

## 4. Start the stack

```bash
docker compose up --build
```

This starts the backend, frontend, and Postgres. Wait until the backend logs show it is listening and the frontend is served.

---

## 5. Subscribe on testnet

1. Open the frontend in your browser (see the compose output for the port).
2. Ensure Freighter is unlocked and set to **Testnet**.
3. Connect the wallet when prompted.
4. Fund the testnet account if needed (testnet friendbot).
5. Complete the subscribe flow.
6. Confirm the subscription appears in the UI and the backend logs the transaction.

---

## 6. Troubleshooting

### Freighter not detected

- Confirm the extension is installed and enabled for the site.
- Reload the page after installing or unlocking Freighter.
- Confirm Freighter is set to **Testnet**, not Mainnet.

### CSP / network errors

- A Content-Security-Policy error usually means the RPC or Horizon URL is not allowed. Verify `VITE_RPC_URL` and the backend RPC URL point at the testnet endpoints.
- Network errors to RPC often mean the endpoint is wrong or the network is set to mainnet. Re-check `STELLAR_NETWORK` / `VITE_STELLAR_NETWORK`.

### Empty contract id

- If contract state fails to load, verify `CONTRACT_ID` and `VITE_CONTRACT_ID` are set and identical. Redeploy if you never deployed.

---

## 7. Windows notes

- Use PowerShell or Git Bash; the compose commands above work in both.
- If `docker compose` is not found, use `docker-compose` (older Docker Desktop).
- Line endings: keep files as-is; do not convert to CRLF if your editor prompts.

---

## 8. Clean-machine checklist

- [ ] Fresh clone, no prior env files.
- [ ] Freighter installed and set to Testnet.
- [ ] Backend and frontend env vars set, contract ids identical.
- [ ] `docker compose up --build` succeeds.
- [ ] Wallet connects and a testnet subscription completes.
