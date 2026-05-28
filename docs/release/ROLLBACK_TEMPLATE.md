# Frontend Rollback Template

Use this template when a frontend release must be rolled back because of production impact, backend incompatibility, or contract dependency issues.

## 1. Incident Summary

- Release name: `...`
- Detection time: `YYYY-MM-DD HH:MM TZ`
- Reported by: `@name`
- Incident commander / rollback owner: `@name`
- Affected environment: `production`
- Impacted user flows:
  - `...`
  - `...`
- Current severity: `SEV-...`

## 2. Rollback Decision

- Rollback approved by: `@name`
- Approval timestamp: `YYYY-MM-DD HH:MM TZ`
- Reason for rollback:
  - [ ] Critical frontend outage
  - [ ] Login/session failure
  - [ ] Checkout or payment failure
  - [ ] Backend API incompatibility
  - [ ] Contract incompatibility or wrong address/config
  - [ ] Unacceptable error-rate increase
  - [ ] Other: `...`

## 3. Rollback Steps

Complete and timestamp each step as it happens.

- [ ] Pause or stop the active rollout.
- [ ] Revert the frontend deployment to the last known good version.
- [ ] Revert or disable the relevant feature flag, if applicable.
- [ ] Confirm backend dependency state is still compatible with the rolled-back frontend.
- [ ] Confirm contract addresses, asset config, and wallet/network settings match the rolled-back frontend version.
- [ ] Notify engineering, product, and support that rollback is in progress.
- [ ] Update the release channel with current status and ETA.

## 4. Stakeholder Communication Message

Copy and fill this message for Slack, email, or the incident channel.

```text
Subject: Frontend rollback in progress - <release name>

We are rolling back the frontend release "<release name>".

Reason:
- <brief description of the issue>

Impact:
- <affected user groups or flows>

Current action:
- Reverting frontend deploy to <last known good version>
- Feature flag status: <enabled/disabled/not applicable>
- Backend/contract dependency status: <summary>

Approved by:
- <name>, <timestamp>

Next update:
- <timestamp or interval>
```

## 5. Post-rollback Verification

- [ ] Previous stable frontend version is serving traffic.
- [ ] Auth/session flows work again.
- [ ] Creator pages and discovery render correctly.
- [ ] Checkout and payment flows are functional or safely disabled.
- [ ] Gated content access state is correct.
- [ ] Monitoring, logs, and support channels show recovery.
- [ ] A short recovery confirmation has been sent to stakeholders.

## 6. Post-mortem Action Items

- Root cause: `...`
- Immediate follow-up ticket(s): `...`
- Release process gap identified: `...`
- Owner for permanent fix: `@name`
- Post-mortem date: `YYYY-MM-DD`
