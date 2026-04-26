# Multi-Asset Price Display – Verification Checklist

Issue: Multi-asset price display (stablecoin vs XLM)

## Automated checks (CI)

Run before merging:

```bash
cd frontend
npm run test -- --reporter=verbose src/lib/assets.test.ts src/lib/plan-form.test.ts
```

Expected: all tests pass with no failures.

---

## Manual checklist

### 1. Asset registry

- [ ] `SUPPORTED_ASSETS` in `src/lib/assets.ts` contains at least **XLM** and **USDC**.
- [ ] XLM entry has `isStablecoin: false`.
- [ ] USDC entry has `isStablecoin: true`.
- [ ] `getAssetSymbol('native')` returns `'XLM'`.
- [ ] `getAssetSymbol('')` returns `'TOKEN'`.
- [ ] `getAssetSymbol('<unknown-contract>')` returns a truncated address (not a crash).

### 2. Plan creation form (`/dashboard` → Create plan)

- [ ] "Payment asset" section shows **XLM** and **USDC** pill buttons.
- [ ] Clicking **XLM** pill fills the token address field with `native` and highlights the pill.
- [ ] Clicking **USDC** pill fills the token address field with the USDC contract and highlights the pill.
- [ ] Manually pasting a different contract address deselects both pills.
- [ ] The live preview card shows the price as `<amount> XLM` (not `$<amount>`).
- [ ] Switching to USDC updates the preview to `<amount> USDC`.

### 3. Subscription confirmation screen

- [ ] When `plan.currency` is `native`, the price row shows `<amount> XLM` with no stablecoin badge.
- [ ] When `plan.currency` is the USDC contract, the price row shows `<amount> USDC` with a green **stablecoin** badge.
- [ ] When `plan.currency` is an unknown contract, the price row shows the truncated address (no crash).

### 4. PlanCard component

- [ ] `<PlanCard assetSymbol="XLM" price={5} />` renders `5.00 XLM /month`.
- [ ] `<PlanCard assetSymbol="USDC" price={10} />` renders `10.00 USDC /month`.
- [ ] Legacy `<PlanCard currencySymbol="$" price={5} />` still renders `$5.00 /month` (backward compat).

### 5. Environment variables

- [ ] `frontend/.env.example` documents `NEXT_PUBLIC_XLM_CONTRACT_ID` and `NEXT_PUBLIC_USDC_CONTRACT_ID`.
- [ ] App starts without errors when both vars are unset (falls back to `native` / empty string).

---

## Rollback

This change is purely additive on the contract layer (no contract changes). To revert the frontend:

```bash
git revert <commit-sha>
cd frontend && npm run build
```
