# MyFans Token (contracts/myfans-token/src/lib.rs)

Standard token implementation.

## Methods

| Method | Args | Returns | Auth | Example Invoke | Expected Events |
|--------|------|---------|------|---------------|-----------------|
| `initialize` | `admin: Address, name: String, symbol: String, decimals: u32, initial_supply: i128` | `()` | admin | `soroban contract invoke ... initialize -- ADMIN "MyFans" MFAN 7 1000000` | None |
| `admin` / `set_admin` | `(new_admin: Address)` | `Address` / `()` | current admin | `soroban contract invoke ... set_admin -- NEW_ADMIN` | None |
| `set_metadata` | `new_name: String, new_symbol: String` | `()` | admin | `soroban contract invoke ... set_metadata -- "NewName" "NEW"` | `("meta_upd") -> (new_name, new_symbol)` |
| `name` / `symbol` / `decimals` / `total_supply` | `()` | `String/u32/i128` | none | `soroban contract invoke ... name` | None |
| `approve` | `from: Address, spender: Address, amount: i128, expiration_ledger: u32` | `()` | from | `soroban contract invoke ... approve -- FROM SPENDER 100 1000000` | `("approve", from, spender) -> amount` |
| `transfer_from` | `spender: Address, from: Address, to: Address, amount: i128` | `()` | spender | `soroban contract invoke ... transfer_from -- SPENDER FROM TO 100` | `("transfer", from, to) -> amount` |
| `allowance` | `from: Address, spender: Address` | `i128` | none | `soroban contract invoke ... allowance -- FROM SPENDER` | None |
| `mint` | `to: Address, amount: i128` | `()` | admin? | `soroban contract invoke ... mint -- TO 1000` | `("mint", to) -> amount` |
| `balance` / `transfer` | `id: Address` / `from: Address, to: Address, amount: i128` | `i128` / `()` | none/from | `soroban contract invoke ... transfer -- FROM TO 100` | `("transfer", from, to) -> amount` |

## Overview
ERC20-like with expiring allowances. Admin minting.

