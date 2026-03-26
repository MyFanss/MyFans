# Frontend Release Checklist and QA Template

Use this checklist for every production release of the Next.js frontend in `frontend/`. The goal is to make each release repeatable, visible, and aligned with backend and contract dependencies.

## Release Summary

| Field | Details |
| --- | --- |
| Release date | `YYYY-MM-DD` |
| Release owner | `@name` |
| Frontend branch / commit | `...` |
| Backend version / commit | `...` |
| Contract package(s) / commit(s) | `...` |
| Environment | `staging` / `production` |
| Deployment window | `start - end` |
| Rollback owner | `@name` |

## 1. Pre-release Checks

Mark each item before production deploy.

- [ ] Scope is frozen and release notes are drafted.
- [ ] Product/design sign-off is complete for all user-visible changes.
- [ ] QA sign-off is complete for all changed frontend flows.
- [ ] Staging environment matches the intended production configuration.
- [ ] Required environment variables, wallet settings, API base URLs, and contract addresses are confirmed.
- [ ] Frontend build succeeds and any required lint/test suite for the release branch is green.
- [ ] Error monitoring, analytics, and logging dashboards are available for release observation.
- [ ] Feature flags are documented with intended default state after deploy.
- [ ] Known issues, acceptable risks, and workarounds are documented in the release notes.
- [ ] On-call or release support contacts are identified for the deployment window.

## 2. Backend and Contract Dependency Alignment

Complete this section before approving production rollout.

### Backend readiness

- [ ] Backend endpoints required by this release are deployed to staging and production.
- [ ] No pending schema, migration, auth, or payload changes block the frontend rollout.
- [ ] API request and response contracts used by the frontend have been validated against current backend behavior.
- [ ] Monitoring exists for release-critical endpoints such as auth, creator discovery, subscriptions, checkout, earnings, and settings.

### Contract readiness

- [ ] Required Soroban contract updates are deployed to the target network before frontend exposure.
- [ ] Contract addresses, asset identifiers, and network configuration used by the frontend are confirmed.
- [ ] Subscription, payment, and access-control flows were validated against the deployed contract version.
- [ ] Any contract limitations, maintenance windows, or chain-level risks are documented for support.

### Cross-team sign-off

| Dependency | Owner | Status | Notes |
| --- | --- | --- | --- |
| Frontend | `@name` | `Pending / Approved` | `...` |
| Backend | `@name` | `Pending / Approved` | `...` |
| Contract | `@name` | `Pending / Approved` | `...` |
| Product / Support | `@name` | `Pending / Approved` | `...` |

## 3. Smoke Test Matrix

Run these checks in staging before deploy and again in production immediately after deploy.

| Area | Scenario | Expected result | Staging | Production |
| --- | --- | --- | --- | --- |
| Landing / discovery | Load home page and creator discovery views | Page renders, data loads, no blocking console/runtime errors | [ ] | [ ] |
| Creator profile | Open a creator page and verify profile content | Creator details, posts, and pricing render correctly | [ ] | [ ] |
| Wallet connection | Connect supported wallet flow | Wallet connects, account state is reflected in UI | [ ] | [ ] |
| Auth / session | Sign in or restore session | User session is created or resumed without redirect loop | [ ] | [ ] |
| Subscription checkout | Start checkout for a plan | Price breakdown, plan summary, and transaction preview are correct | [ ] | [ ] |
| Contract-backed payment | Complete or simulate a subscription transaction | Status updates are shown and backend reflects active subscription state | [ ] | [ ] |
| Gated content access | Visit protected content after subscription check | Eligible user can access content; ineligible user is blocked gracefully | [ ] | [ ] |
| Creator dashboard | Open dashboard home, plans, content, subscribers, and earnings | Data loads and empty/loading/error states behave correctly | [ ] | [ ] |
| Settings | Update profile/settings inputs | Form validation works and saves persist | [ ] | [ ] |
| Error handling | Trigger a known recoverable error path | User sees actionable error UI and errors are captured in monitoring | [ ] | [ ] |
| Responsive QA | Verify mobile and desktop layouts for changed screens | Layout, navigation, and interactions remain usable | [ ] | [ ] |

## 4. Deployment Checklist

- [ ] Release owner announces deployment start in the agreed engineering/support channel.
- [ ] Final staging smoke test completed within the same day as production deploy.
- [ ] Production deployment completed successfully.
- [ ] Production smoke test matrix completed.
- [ ] Error rate, API health, wallet flow success, and subscription funnel metrics remain within expected range for the first 30 minutes.
- [ ] Release owner posts completion status and any follow-up actions.

## 5. Rollback Triggers

Rollback should be initiated if any of the following occur and cannot be mitigated quickly:

- [ ] Frontend is unavailable or failing to build/serve in production.
- [ ] Login, wallet connection, checkout, or gated access is broken for a material percentage of users.
- [ ] Backend or contract incompatibility causes failed transactions, invalid UI state, or data corruption risk.
- [ ] Monitoring shows a sustained spike in frontend errors, API failures, or payment/subscription drop-off after release.

## 6. Rollback Communication Template

Copy, fill in, and post in the release channel if rollback is required.

```text
Subject: Frontend rollback in progress - <release name> - <YYYY-MM-DD HH:MM TZ>

Status:
- We are rolling back the frontend release for <release name>.
- Impact: <affected users / flows>.
- Detection time: <timestamp>.
- Rollback owner: <name>.

What changed:
- Frontend version: <commit / deployment id>.
- Related backend version: <commit / deployment id>.
- Related contract version: <package / commit / network>.

Current action:
- Rollback has started / completed.
- ETA to recovery: <time or TBD>.

Next update:
- We will post the next update by <timestamp>.
```

## 7. Post-release Notes

Capture final outcomes after the release window closes.

- Release result: `Successful / Rolled back / Partial`
- Incident or follow-up ticket(s): `...`
- Monitoring links: `...`
- Lessons learned / process updates for next release: `...`
