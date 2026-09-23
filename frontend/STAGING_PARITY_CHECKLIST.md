# Staging Environment Parity Checklist

This document provides a guide for maintaining parity between the Staging and Production environments for the MyFans frontend.

## Environment Variable Mapping

The following `NEXT_PUBLIC_` variables control the frontend's behavior across different environments.

| Variable | Staging (Recommended) | Production (Recommended) | Requirement |
|----------|-----------------------|--------------------------|-------------|
| `NEXT_PUBLIC_APP_ENV` | `staging` | `production` | **REQUIRED** |
| `NEXT_PUBLIC_API_URL` | Staging API URL | Production API URL | **REQUIRED** |
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` (or `futurenet`) | `mainnet` | **REQUIRED** |
| `NEXT_PUBLIC_HORIZON_URL` | https://horizon-testnet.stellar.org | https://horizon.stellar.org | **MATCH NETWORK** |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | https://soroban-testnet.stellar.org | https://mainnet.sorobanrpc.com | **MATCH NETWORK** |
| `NEXT_PUBLIC_TOKEN_CONTRACT_ID` | Testnet Contract ID | Mainnet Contract ID | **MATCH NETWORK** |
| `NEXT_PUBLIC_CREATOR_REGISTRY_CONTRACT_ID` | Testnet Contract ID | Mainnet Contract ID | **MATCH NETWORK** |
| `NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ID` | Testnet Contract ID | Mainnet Contract ID | **MATCH NETWORK** |
| `NEXT_PUBLIC_CONTENT_ACCESS_CONTRACT_ID` | Testnet Contract ID | Mainnet Contract ID | **MATCH NETWORK** |
| `NEXT_PUBLIC_EARNINGS_CONTRACT_ID` | Testnet Contract ID | Mainnet Contract ID | **MATCH NETWORK** |
| `NEXT_PUBLIC_FLAG_BOOKMARKS` | `true` (if testing) | `false` (until release) | Parity Optional |
| `NEXT_PUBLIC_FLAG_REFERRAL_CODES` | `true` (if testing) | `false` (until release) | Parity Optional |
| `NEXT_PUBLIC_FLAG_WALLETCONNECT` | `true` (if testing) | `false` (default off) | Parity Optional |
| `NEXT_PUBLIC_FLAG_UPLOADS` | `true` (if testing) | `false` (until release) | Parity Optional |
| `NEXT_PUBLIC_FLAG_POLLER` | `true` (if testing) | `false` (prod default off) | Parity Optional |
| `NEXT_PUBLIC_FEATURE_FLAGS_URL` | Staging Flags URL | Production Flags URL | Recommended |

## Feature Flag Defaults & Blast Radius

Flags are resolved by the backend `FeatureFlagsModule` and consumed by the frontend. Defaults are chosen to be **safe**: a flag that is unset or unknown resolves to `false` (off), and boolean strings are coerced (`"true"`/`"1"` → on, `"false"`/`"0"`/anything else → off). Unknown flags never crash — they fall back to the safe default.

| Flag | Staging Default | Production Default | Blast Radius if Misconfigured |
|------|-----------------|--------------------|-------------------------------|
| `WALLETCONNECT` | off | **off** | Half-broken WalletConnect sessions; users cannot connect via WC. Keep off until the WC flow is verified end-to-end. |
| `UPLOADS` | off | off (documented) | Uploads surface enabled before storage/CDN is ready; orphaned assets. Documented default is off. |
| `POLLER` | off | **off (explicit)** | Poller storms / excess backend load in prod. Production default is explicitly off; enable only with a tuned interval. |
| `BOOKMARKS` | off | off | Minor UI surface; low risk. |
| `REFERRAL_CODES` | off | off | Referral links exposed before release; low risk. |

> **Security:** Dangerous flags (e.g. `WALLETCONNECT`, `POLLER`) should require an admin role to flip at runtime where runtime toggling is supported. Never enable them by default in production.

## Parity Verification Checklist

### 1. Networking & API
- [ ] `NEXT_PUBLIC_API_URL` points to the correct environment's backend.
- [ ] `NEXT_PUBLIC_STELLAR_NETWORK` matches the intended Stellar network (Testnet for Staging, Mainnet for Production).
- [ ] `NEXT_PUBLIC_HORIZON_URL` and `NEXT_PUBLIC_SOROBAN_RPC_URL` are consistent with the selected network.

### 2. Smart Contracts
- [ ] All contract IDs are correctly set for the target network.
- [ ] Verified that the contracts are actually deployed on the network specified by the RPC URLs.

### 3. Feature Flags
- [ ] `NEXT_PUBLIC_FEATURE_FLAGS_URL` is set to the environment-specific flag provider (if using a remote provider).
- [ ] Any local overrides in environment variables match the release plan.
- [ ] `WALLETCONNECT`, `UPLOADS`, and `POLLER` are **off** in production unless explicitly enabled per the blast-radius table above.
- [ ] Staging vs Production flag values are compared and any intentional mismatch is documented.

### 4. Security
- [ ] `NODE_ENV` is set to `production` for both Staging and Production builds to ensure optimizations and strict security headers are applied.
- [ ] CSP headers are verified to allow the API and Stellar hosts configured for the environment.
- [ ] Dangerous flags require an admin role to flip at runtime.

## Verification Commands

To verify the current build configuration, you can check the headers or use the following command in the browser console:

```javascript
// Check runtime contract config
console.table(window.__MYFANS_RUNTIME_CONTRACT_CONFIG__);

// Check feature flags
console.table(JSON.parse(localStorage.getItem('flags:status') || '{}'));
```

## Troubleshooting Parity Issues

- **CORS Errors**: Ensure the frontend URL for the environment is added to the backend's `CORS_ALLOWED_ORIGINS`.
- **Contract Mismatches**: If transactions fail with "Contract not found", double-check that the ID in the environment variables matches the deployment on the current `NEXT_PUBLIC_STELLAR_NETWORK`.
- **UI Differences**: Ensure both environments are using the same build command (`npm run build`) and have the same `NODE_ENV`.
- **Flag Mismatches**: If a feature behaves differently between Staging and Production, compare the flag values against the blast-radius table and confirm the production defaults (`WALLETCONNECT`/`UPLOADS`/`POLLER` off).
