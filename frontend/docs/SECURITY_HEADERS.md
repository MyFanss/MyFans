# Security Headers Configuration

## Cross-Origin Policies

### Cross-Origin-Embedder-Policy (COEP)

**Current Strategy:** Route-scoped COEP settings

- **Wallet-heavy routes** (`/checkout`, `/subscribe`, `/wallet-demo`): `credentialless`
  - Allows wallet extensions (Freighter, Lobstr, etc.) to inject scripts and load cross-origin resources
  - Acceptable security tradeoff since payment/wallet operations are high-friction user journeys
  - Extensions still cannot access credentials in same-origin requests

- **Other routes**: `require-corp`
  - Stricter security for non-wallet routes
  - Requires cross-origin resources to explicitly opt-in via CORP headers

**Rationale:**
- Freighter and Lobstr wallet extensions need to dynamically inject scripts during checkout
- Strict COEP (`require-corp`) breaks these extensions since embedded scripts cannot load freely
- `credentialless` mode relaxes COEP restrictions while preventing credential leakage
- This is a reasonable security/usability tradeoff for payment flows

### Cross-Origin-Opener-Policy (COOP)
- `same-origin` (applied globally)
- Prevents cross-origin scripts from accessing window references

### Cross-Origin-Resource-Policy (CORP)
- `cross-origin` (applied globally)
- Allows wallet extensions to load cross-origin resources (e.g., external libraries, RPC endpoints)
- Updated from `same-origin` to support wallet extension integration

## Content-Security-Policy (CSP)

### connect-src allowlist

The `connect-src` directive is **env-driven** and defaults to deny. Only the origins
required for Horizon, Soroban RPC, the backend API, and wallet extensions are allowed.

Configured via environment variables (see `frontend/docs/CSP.md` for the full matrix):

| Variable | Purpose | Example |
|----------|---------|---------|
| `NEXT_PUBLIC_HORIZON_URL` | Stellar Horizon endpoint | `https://horizon.stellar.org` |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Soroban RPC endpoint | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_API_URL` | Backend API origin | `https://api.example.com` |
| `NEXT_PUBLIC_CSP_CONNECT_SRC_EXTRA` | Space-separated extra origins (staging only) | `https://staging-api.example.com` |

**Rules:**

- **Default deny:** if an origin is not listed, it is blocked.
- **No wildcards in production:** `*`, `https:` and `wss:` bare schemes are rejected in
  production builds. Wildcards are only tolerated in local development.
- **Wallet extensions:** Freighter and Lobstr inject their own scripts and open
  connections to their own origins. These are covered by the extension's own CSP
  context; the app's `connect-src` only needs to allow the RPC/Horizon/API origins the
  app itself fetches. See `frontend/docs/CSP.md` for the extension requirements.
- **WalletConnect relay:** when the WalletConnect feature flag is enabled, the relay
  origin (`wss://relay.walletconnect.com`) must be added to the allowlist.
- **Report-URI (optional):** set `NEXT_PUBLIC_CSP_REPORT_URI` to collect violations.
  Reporting is opt-in and never replaces enforcement.

### Staging

Staging may add extra API origins via `NEXT_PUBLIC_CSP_CONNECT_SRC_EXTRA`. These are
merged into `connect-src` at build time and must still be explicit origins (no wildcards).

## Trade-offs

| Policy | Setting | Benefit | Risk |
|--------|---------|---------|------|
| COEP | Route-scoped | Wallet extensions work only where needed | Complex routing logic |
| CORP | cross-origin | Extensions can fetch external resources | Non-same-origin requests exposed to CORP-enabled sites |
| COOP | same-origin | Opener isolation maintained | Extensions in iframes limited |
| CSP connect-src | Env-driven allowlist | Default-deny XSS containment | Misconfiguration blocks RPC/API |

## Future Improvements

1. Monitor wallet extension compatibility (Freighter, Lobstr, Ledger)
2. Consider `crossOriginIsolated` API once browser support is wider
3. Implement CSP refinements for payment routes if issues arise
4. Document any wallet-specific workarounds in a separate guide

## References
- [MDN COEP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Embedder-Policy)
- [MDN CORP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Resource-Policy)
- [COOP & COEP Explainer](https://web.dev/cross-origin-isolation/)
- [MDN CSP connect-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/connect-src)
