# AUTH_MATRIX

Authorization matrix for privileged operations across contracts. Each row lists the
operation, the required authorization, and the expected outcome for valid and invalid
callers. Negative cases MUST NOT use `mock_all_auths`; they must exercise the real
`require_auth` path so that unauthorized callers revert.

## myfans-token

| Operation | Required auth | Valid caller | Invalid caller | Expected revert |
|-----------|---------------|--------------|----------------|-----------------|
| `mint(to, amount)` | `admin.require_auth()` | admin | non-admin | `Unauthorized` |
| `burn(from, amount)` | `from.require_auth()` | token holder | non-holder | `Unauthorized` |
| `transfer(from, to, amount)` | `from.require_auth()` | token holder | non-holder | `Unauthorized` |
| `mint` overflow | admin | admin | — | `Overflow` |
| `burn` > balance | holder | holder | — | `InsufficientBalance` |
| `transfer` > balance | holder | holder | — | `InsufficientBalance` |

### Invariants

- `total_supply` increases by exactly `amount` on a successful `mint`.
- `total_supply` decreases by exactly `amount` on a successful `burn`.
- `total_supply` never underflows (burn cannot exceed total supply).
- `balance_of(account)` never underflows (burn/transfer cannot exceed balance).
- All arithmetic uses `checked_add` / `checked_sub` with typed reverts.

### Test coverage

- Happy paths: admin mint, holder burn, holder transfer.
- Negative auth: non-admin mint reverts; non-holder burn/transfer reverts.
- Overflow: mint that would exceed `i128::MAX` reverts with `Overflow`.
- Underflow: burn/transfer exceeding balance reverts with `InsufficientBalance`.
- Run with `cargo test -p myfans-token`.
