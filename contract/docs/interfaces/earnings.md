# Earnings Contract (contracts/earnings/src/lib.rs)

Admin-tracked earnings totals.

## Methods

| Method | Args | Returns | Auth | Example Invoke | Expected Events |
|--------|------|---------|------|---------------|-----------------|
| `init` | `admin: Address` | `()` | admin | `soroban contract invoke ... init -- ADMIN` | None |
| `admin` | `()` | `Address` | none | `soroban contract invoke ... admin` | None |
| `record` | `creator: Address, amount: i128` | `()` | admin | `soroban contract invoke ... record -- CREATOR 1000` | None |
| `get_earnings` | `creator: Address` | `i128` | none | `soroban contract invoke ... get_earnings -- CREATOR` | None |
| `withdraw` | `creator: Address, amount: i128` | `()` | creator | `soroban contract invoke ... withdraw -- CREATOR 500` | `("withdrawn", creator) -> amount` |

## Overview
Admin records per-creator earnings totals. Simple accumulator.

