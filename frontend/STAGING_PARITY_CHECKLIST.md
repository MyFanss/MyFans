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
| `NEXT_PUBLIC_FEATURE_FLAGS_URL` | Staging Flags URL | Production Flags URL | Recommended |

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

### 4. Security
- [ ] `NODE_ENV` is set to `production` for both Staging and Production builds to ensure optimizations and strict security headers are applied.
- [ ] CSP headers are verified to allow the API and Stellar hosts configured for the environment.

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
