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

## Trade-offs

| Policy | Setting | Benefit | Risk |
|--------|---------|---------|------|
| COEP | Route-scoped | Wallet extensions work only where needed | Complex routing logic |
| CORP | cross-origin | Extensions can fetch external resources | Non-same-origin requests exposed to CORP-enabled sites |
| COOP | same-origin | Opener isolation maintained | Extensions in iframes limited |

## Future Improvements

1. Monitor wallet extension compatibility (Freighter, Lobstr, Ledger)
2. Consider `crossOriginIsolated` API once browser support is wider
3. Implement CSP refinements for payment routes if issues arise
4. Document any wallet-specific workarounds in a separate guide

## References
- [MDN COEP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Embedder-Policy)
- [MDN CORP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Resource-Policy)
- [COOP & COEP Explainer](https://web.dev/cross-origin-isolation/)
