# Frontend Smoke Test Matrix

Run this matrix twice for every release:

1. On staging after the candidate deploy.
2. On production immediately after release.

Mark each row as `Pass`, `Fail`, or `N/A` and record follow-up tickets for anything that does not pass cleanly.

## Test Matrix

| Area | Scenario | Viewport / Browser | Dependencies | Expected Result | Staging | Production | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Auth | Sign up or first-time onboarding entry point | Desktop + mobile, Chrome | Backend auth/session APIs | User can start account flow without blocking errors | [ ] | [ ] | `...` |
| Auth | Login and session restore | Desktop + mobile, Chrome + Firefox | Backend auth/session APIs | User can sign in or restore an existing session without redirect loops | [ ] | [ ] | `...` |
| Auth | Logout | Desktop, Chrome | Backend auth/session APIs | Session clears and protected routes no longer show authenticated state | [ ] | [ ] | `...` |
| Discovery | Home page and discover/creator listing views | Desktop + mobile, Chrome + Safari | Backend creator APIs | Pages render, data loads, and empty/loading states look correct | [ ] | [ ] | `...` |
| Creator pages | Open a creator profile and inspect pricing/content preview | Desktop + mobile, Chrome | Backend creator/profile APIs | Creator metadata, plans, and preview content render correctly | [ ] | [ ] | `...` |
| Subscriptions | Start a subscription checkout flow | Desktop, Chrome + Firefox | Backend checkout APIs + contract configuration | Plan details, pricing, and transaction preview are correct | [ ] | [ ] | `...` |
| Payments | Complete or simulate contract-backed payment | Desktop, Chrome | Backend checkout APIs + contract calls | Payment state updates in UI and resulting subscription state is reflected | [ ] | [ ] | `...` |
| Gated content | Access content after successful subscription | Desktop + mobile, Chrome | Backend access checks + contract/subscription status | Eligible users see content and ineligible users get graceful fallback UI | [ ] | [ ] | `...` |
| Settings | Update user or creator settings | Desktop, Chrome | Backend settings/profile APIs | Validation works, save succeeds, and persisted values reload correctly | [ ] | [ ] | `...` |
| Dashboard | Open dashboard pages relevant to the release | Desktop, Chrome + Firefox | Backend dashboard APIs | Metrics, tables, loading states, and empty states render correctly | [ ] | [ ] | `...` |
| Error handling | Trigger a known recoverable failure path | Desktop + mobile, Chrome | Backend error responses | Error UI is understandable and does not leave the app stuck | [ ] | [ ] | `...` |
| Responsive QA | Re-check changed screens on mobile and desktop | Mobile Safari + desktop Chrome | Frontend only | Layout, spacing, navigation, and primary interactions remain usable | [ ] | [ ] | `...` |

## Cross-browser Coverage

Use this table to record the minimum browser pass set for the release.

| Browser | Desktop | Mobile | Status | Notes |
| --- | --- | --- | --- | --- |
| Chrome | [ ] | [ ] | `Pending / Pass / Fail` | `...` |
| Firefox | [ ] | n/a | `Pending / Pass / Fail` | `...` |
| Safari | [ ] | [ ] | `Pending / Pass / Fail` | `...` |

## Release-critical Focus Areas

If the release changes any of the areas below, make sure they are explicitly covered above:

- login, logout, and session restore
- creator pages and discovery
- subscriptions, checkout, and payment confirmation
- wallet or contract interaction states
- backend-integrated loading, empty, and error states
- mobile and desktop behavior for changed UI
