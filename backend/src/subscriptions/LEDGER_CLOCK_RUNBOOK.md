# Ledger Clock & Subscription Gating Runbook

## Overview

The subscription gating system uses **ledger time** (not wall-clock time) for all expiry checks. This ensures gating is consistent with on-chain contract state, which operates on ledger timestamps.

- **Ledger time** = Stellar ledger close time + skew correction
- **Skew** = drift between ledger time and server wall clock (can be ±seconds)
- **Why it matters**: The chain can think it's 11:01 while your server says 11:00. If you gate on wall-clock, you deny access to subscriptions that are valid on-chain.

## How It Works

### Clock Source

1. **LedgerClockService** fetches the latest ledger close time from Horizon every sync cycle (or on-demand for gating checks).
2. Returns a `LedgerClockSnapshot` containing:
   - `ledgerCloseTimeUnix`: seconds since Unix epoch (ledger time)
   - `skewMs`: milliseconds of drift (negative = ledger is behind)
   - `ledgerSeq`: latest ledger number

### Gating Logic

When a request arrives:

1. **Cache check** (positive only): instant allow if recently verified
2. **Index check**: fast local DB check
3. **Chain check** (if index says no): simulate `is_subscriber` on RPC
4. All expiry comparisons use `ledgerNowUnix(snapshot)`, not `Date.now()`

### Fail-Closed Behavior

**If the clock cannot be read:**
- **Gated content**: access DENIED (no unlock, no teaser)
- **Checkout**: returns HTTP 503 (Service Unavailable)
- **Sync**: aborts entirely (no subscriptions are updated)

This is intentional: better to deny access temporarily than to silently grant access to expired subscriptions.

## Diagnosing Clock Issues

### Symptoms

- Users report being locked out despite active subscriptions
- Sync jobs complete with all records marked "skipped"
- Logs show `Failed to fetch ledger clock: Horizon unreachable`

### Diagnostics

1. **Check Horizon connectivity**:
   ```bash
   curl https://horizon-testnet.stellar.org/ledgers?order=desc&limit=1
   ```
   Should return HTTP 200 with latest ledger.

2. **Check skew metric**:
   - Look for `clock_skew_ms` in metrics/logs
   - Skew > ±60,000 ms (1 minute) is logged as a warning
   - Skew > ±300,000 ms (5 minutes) suggests NTP issues on the host

3. **Check NTP on the server**:
   ```bash
   ntpstat
   timedatectl
   ```
   If NTP is not synced, the server's wall clock is unreliable and skew corrections won't help.

### Typical Causes

| Cause | Fix |
|-------|-----|
| Horizon API is down | Wait for Horizon recovery or switch to fallback endpoint |
| Network partition (server → Horizon) | Check firewall, routing, DNS |
| NTP desync on host | Restart NTP service, check system time |
| Ledger reorg (rare) | Sync will catch up on next cycle; no manual action needed |

## Recovery Steps

### 1. If Horizon is temporarily unreachable

- Users will see "access denied" temporarily
- Sync jobs will abort without changing state
- **No manual action required** — sync will resume when Horizon recovers

### 2. If NTP is desync and time is wildly off

```bash
# Check current time vs NTP time
ntpstat
date

# Manually adjust if critical (should rarely be needed)
sudo ntpdate -s pool.ntp.org
# Then restart NTP
sudo systemctl restart ntp  # or chrony, depending on distro
```

### 3. If skew is repeatedly > ±60 seconds

- This is unusual and suggests environmental issues
- Check Horizon's own clock vs. your server's clock separately
- Consider swapping the Horizon endpoint (testnet ↔ futurenet) to isolate the issue

### 4. To manually verify a subscription while clock is unavailable

1. Query the index directly:
   ```bash
   SELECT * FROM subscription_index WHERE fan = '...' AND creator = '...';
   ```
2. Call `GET /v1/subscriptions/me/subscription-state?creator=...` — it will return both indexed and chain status (chain status will have an error if clock failed)

## What NOT To Do

- **Do NOT** disable ledger-time gating and fall back to wall-clock. This creates a security hole where expired subscriptions can grant access.
- **Do NOT** disable Horizon connectivity checks. If the clock is unavailable, the correct behavior is to fail closed.
- **Do NOT** manually update `subscription_index.expiryUnix` to work around clock issues. The sync job will re-read the chain and correct it.

## Monitoring

Alert if:
- Sync job failure rate > 5% for 10+ consecutive cycles
- `clock_skew_ms` > ±60,000 for 5+ consecutive cycles
- Horizon endpoint responds with HTTP 5xx for > 2 minutes
- NTP status is "unsync"

## References

- [Stellar Ledger Documentation](https://developers.stellar.org/docs/learn/stellar-and-lumens)
- [LedgerClockService](./ledger-clock.service.ts)
- [SubscriptionChainSyncService](./services/subscription-chain-sync.service.ts)
