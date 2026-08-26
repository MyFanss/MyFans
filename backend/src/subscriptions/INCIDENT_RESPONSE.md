# Subscription Admin Incident Response Runbook

## Overview

The subscription system can be paused by admins as an emergency kill switch. This runbook covers when and how to pause/unpause subscriptions, what happens during a pause, and how to verify the state.

## When to Pause Subscriptions

Pause subscriptions if:

- **Contract bug discovered**: An exploit or data corruption is found on-chain
- **RPC provider outage**: Horizon/Soroban RPC is down and affecting gating checks
- **Ledger clock issues**: Clock skew is > 1 hour and causing incorrect gating
- **System shutdown**: Scheduled maintenance or emergency mitigation
- **Payment processing issue**: A critical bug in the checkout flow is discovered

## How to Pause Subscriptions

### Via Admin API

1. **Authenticate as an ADMIN user**:
   - Get a valid JWT token with role: `ADMIN`
   - Add to request header: `Authorization: Bearer <JWT>`

2. **Send the pause request**:
   ```bash
   curl -X POST \
     -H "Authorization: Bearer <ADMIN_JWT>" \
     -H "Content-Type: application/json" \
     -d '{"reason":"Emergency: contract exploit detected"}' \
     https://api.example.com/v1/subscriptions/admin/pause
   ```

3. **Response (on success)**:
   ```json
   {
     "paused": true,
     "pausedAt": "2026-08-26T14:30:00.123Z",
     "pausedBy": "admin-user-uuid",
     "reason": "Emergency: contract exploit detected"
   }
   ```

### Via stellar-cli (if Admin Keys Are Kept Offline)

_If admin keys are intentionally stored offline (not in the API server), use the following approach:_

1. **Prepare the pause transaction** (from an offline machine with admin keys):
   ```bash
   stellar-cli contract invoke \
     --source-account ADMIN_KEYPAIR \
     --contract-id <CONTRACT_ID> \
     --network testnet \
     --operation pause
   ```

2. **Submit the transaction** (may require manual approval):
   ```bash
   # Broadcast the signed transaction to the network
   stellar-cli transaction submit <TRANSACTION_ENVELOPE>
   ```

3. **Verify on-chain** (from any API server):
   ```bash
   stellar-cli contract read \
     --contract-id <CONTRACT_ID> \
     --network testnet \
     --key is_paused
   ```

## What Happens When Paused

### Subscription Gating (GatedContentGuard)

- ✗ Access to gated/subscriber-only content is **DENIED**
- ✗ Users see: "Subscriptions temporarily unavailable" message
- ✓ Error is logged with audit trail
- ✓ Chain is still queried (for debugging), but result is ignored

### Checkout Flow

- ✗ New subscription checkouts return **HTTP 503 Service Unavailable**
- ✗ Existing checkout sessions **cannot be confirmed**
- ✗ Users see: "Subscriptions temporarily paused" message
- ✓ Checkout sessions are preserved (not deleted)

### Event Poller

- ✗ New subscription events are **not indexed**
- ✗ Renewal events are **not processed**
- ✗ Cancellation events are **not processed**
- ✓ RPC is still queried (for later recovery), but events are dropped

### User Experience

| Action | Result | Message |
|--------|--------|---------|
| Try to access gated post | Denied | "Subscriptions temporarily unavailable" |
| Try to subscribe | 503 error | "Subscriptions temporarily paused. Please try again later." |
| Already subscribed | Can still access (from cache/index) | None |
| Check subscription status | Stale data | Reflects last-known status before pause |

## How to Verify Pause Is Active

### 1. Check via Admin API

```bash
curl -H "Authorization: Bearer <ADMIN_JWT>" \
  https://api.example.com/v1/subscriptions/admin/status
```

Response (paused):
```json
{
  "paused": true,
  "pausedAt": "2026-08-26T14:30:00Z",
  "pausedBy": "admin-user-uuid",
  "reason": "Emergency: contract exploit detected"
}
```

### 2. Check Server Logs

Look for the pause event:
```
[WARN] SubscriptionPauseService: Subscriptions paused by admin-uuid: Emergency: contract exploit detected
```

### 3. Test Gating Manually

Try accessing a gated endpoint:
```bash
curl -H "Authorization: Bearer <FAN_JWT>" \
  https://api.example.com/v1/posts/gated/<POST_ID>
```

Expected: **HTTP 403 Forbidden** with message "Subscriptions temporarily unavailable"

### 4. Test Checkout

Attempt a new subscription:
```bash
curl -X POST \
  -H "Authorization: Bearer <FAN_JWT>" \
  -d '{"fanAddress":"G...","creatorAddress":"G...","planId":1}' \
  https://api.example.com/v1/subscriptions/checkout
```

Expected: **HTTP 503 Service Unavailable** with message "Subscriptions temporarily paused"

## How to Unpause Subscriptions

### Via Admin API

```bash
curl -X POST \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  https://api.example.com/v1/subscriptions/admin/unpause
```

Response:
```json
{
  "paused": false,
  "pausedAt": null,
  "pausedBy": null,
  "reason": null
}
```

### Via stellar-cli

```bash
stellar-cli contract invoke \
  --source-account ADMIN_KEYPAIR \
  --contract-id <CONTRACT_ID> \
  --network testnet \
  --operation unpause
```

## After Unpausing

1. **Verify unpause is active** (same checks as above; `paused` should be `false`)
2. **Drain the event backlog**: The event poller will resume processing events from the last known checkpoint. Depending on pause duration:
   - < 1 hour: caught up in 2-3 poll cycles (90 seconds)
   - 1-6 hours: caught up in 10-15 minutes
   - > 6 hours: may take 30+ minutes to catch up
3. **Monitor metrics**:
   - `subscription_index_lag_seconds` should trend toward 0
   - No increase in `rpc_errors_total` (check for ongoing issues)
4. **Notify affected users** (if pause lasted > 30 seconds):
   - Post: "Subscriptions are back online. Enjoy your content!"
   - Email: "Subscription service restored" to active subscribers

## Troubleshooting

### Pause Fails (401/403 Unauthorized)

**Cause**: JWT token invalid or role is not ADMIN

**Fix**:
1. Verify JWT is not expired: `jwt decode <TOKEN>`
2. Check token's role claim: should be `{"role":"ADMIN"}`
3. Re-authenticate and obtain new ADMIN token

### Unpause Fails (still shows paused)

**Cause**: Another admin paused it again while you were unpausing

**Fix**:
1. Send unpause request again
2. Verify final status via `GET /admin/status`

### Pause Worked But Gating Still Allows Access

**Cause**: Cache hit from `SubscriptionCacheService` (1-minute TTL)

**Expected behavior**: 
- Newly authenticated users: immediately denied ✓
- Already-authenticated in-flight requests: may use cached result (will deny on next check)
- **This is OK and by design** — the cache prevents hammering the DB

**Workaround**: Wait 1 minute for cache TTL to expire, or force re-auth

### Pause State Not Reflected in Logs

**Cause**: Log level is not set to WARN or higher

**Fix**: Check server log level configuration:
```bash
# Find current log level in .env or config
echo $LOG_LEVEL  # should be WARN, INFO, or DEBUG
```

## Recovery After Extended Pause

If subscriptions were paused for > 1 hour:

1. **Unpause** (as above)
2. **Monitor sync job** for 10 minutes:
   ```bash
   # Check latest sync result
   tail -100 logs/subscription-sync.log | grep "Poll complete"
   ```
3. **Verify subscription index** is catching up:
   ```bash
   # Should show recent event timestamps (within 5 minutes)
   SELECT MAX(indexed_at) FROM subscription_index;
   ```
4. **Resend outage notification** to creators explaining the downtime

## Audit & Compliance

All pause/unpause events are logged with:
- Admin user ID (`pausedBy`)
- Timestamp (`pausedAt`)
- Reason (free-text, required for compliance)

**Log all pause events for audit trail**:
```bash
# Review pause events in past 24 hours
grep "Subscriptions paused\|Subscriptions unpaused" logs/app.log
```

## Escalation

If pause/unpause is not working:

1. **Check API server health**: Is the subscriptions service running?
2. **Check database**: Can the service connect to the database?
3. **Check JWT issuer**: Is the auth service operational?
4. If all services are up, file an incident for the backend team

---

**Last updated**: 2026-08-26  
**Maintainer**: Backend team (subscriptions)
