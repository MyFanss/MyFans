# Auth Matrix

Signer requirements for every public entrypoint in the contracts under `contract/contracts/`.
Update this table whenever an auth rule changes (see `contract/README.md`).

"Unchanged on auth failure" describes what state stays untouched when the required
signature is missing or invalid: the call reverts before any state is written, so the
listed state is preserved.

| Contract | Method | Required signer | Unchanged on auth failure |
| --- | --- | --- | --- |
| myfans-token | `initialize` | **none (open)** — no `require_auth` today | Nothing is written; the gap is that anyone can call it first |
| myfans-token | `mint` | admin (`require_auth` on admin) | Total supply, balances, and admin record |
| myfans-token | `burn` | holder (`require_auth` on the burner) | Total supply and balances |
| myfans-token | `transfer` | sender (`require_auth` on `from`) | Balances of `from` and `to` |
| myfans-token | `approve` | owner (`require_auth` on `from`) | Allowance entry |
| myfans-token | `transfer_from` | spender (`require_auth` on `spender`) | Allowance, balances of `from` and `to` |
| myfans-token | `balance` | none (read-only) | No state changes |
| myfans-token | `allowance` | none (read-only) | No state changes |
| myfans-token | `total_supply` | none (read-only) | No state changes |
| myfans-token | `decimals` | none (read-only) | No state changes |
| myfans-token | `name` | none (read-only) | No state changes |
| myfans-token | `symbol` | none (read-only) | No state changes |
| treasury | `initialize` | admin (`require_auth` on admin) | Treasury config and admin record |
| treasury | `deposit` | depositor (`require_auth` on `from`) | Treasury balance and depositor balance |
| treasury | `withdraw` | admin (`require_auth` on admin) | Treasury balance and recipient balance |
| treasury | `set_admin` | current admin (`require_auth` on admin) | Admin record |
| treasury | `balance` | none (read-only) | No state changes |
| treasury | `admin` | none (read-only) | No state changes |
| subscription | `initialize` | admin (`require_auth` on admin) | Subscription config and admin record |
| subscription | `subscribe` | subscriber (`require_auth` on `subscriber`) | Subscription record and balances |
| subscription | `cancel` | subscriber (`require_auth` on `subscriber`) | Subscription record |
| subscription | `renew` | subscriber (`require_auth` on `subscriber`) | Subscription record and balances |
| subscription | `withdraw` | creator (`require_auth` on creator) | Creator balance and recipient balance |
| subscription | `set_price` | admin (`require_auth` on admin) | Price config |
| subscription | `subscription_of` | none (read-only) | No state changes |
| subscription | `price` | none (read-only) | No state changes |

## Open methods

- `myfans-token::initialize` has **no** `require_auth` check. The treasury version does.
  Until this is fixed, treat token initialization as unauthenticated and initialize
  immediately after deploy.
