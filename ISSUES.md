# MyFans – Issue Backlog

---

## 1. Treasury: integration tests with real auth (no mocks)

**Description**  
The goal is to assert exact auth requirements for treasury. Add at least one test that uses `mock_auths` with specific `MockAuth` entries instead of `mock_all_auths`. Validate initialize requires admin; deposit requires from; withdraw requires admin. Reference existing treasury_test and set_auths usage.

**Tasks**
- Add mock_auths for initialize (admin), deposit (user), and token mint (admin)
- Call initialize, deposit, then try_withdraw as unauthorized and assert error
- Ensure no mock_all_auths in that test path

**Acceptance Criteria**
- Test uses mock_auths only for setup calls
- Unauthorized withdraw fails
- All treasury tests pass

---

## 2. Creator-deposits: unauthorized withdraw revert test

**Description**  
The goal is to ensure only the creator (or admin) can withdraw. Add a test that calls withdraw as a non-creator address. Use `set_auths(&[])` or `mock_auths` so auth is not fully mocked. Validate contract reverts or returns error. Reference treasury test_unauthorized_withdraw_reverts.

**Tasks**
- Add test_unauthorized_withdraw_reverts (or equivalent)
- Setup: register creator, deposit; do not mock auth for withdraw call
- Assert try_withdraw as other address returns error

**Acceptance Criteria**
- Non-creator cannot withdraw
- Stake unchanged
- Test passes in CI

---

## 3. Subscription contract: snapshot/restore tests

**Description**  
The goal is to verify subscription state consistency across operations. Use `env.to_snapshot()` and `env.from_snapshot()` (or equivalent) to save state after subscribe, then restore and assert plan, expiry, and fan are correct. Add test that cancels after restore and checks state.

**Tasks**
- Implement snapshot after subscribe
- Restore env and assert subscription data
- Add test for cancel after restore
- Assert joined_players / counts if applicable

**Acceptance Criteria**
- State matches after restore
- Cancel works after restore
- Tests pass

---

## 4. Content-access: expired or invalid unlock tests

**Description**  
The goal is to ensure unlock fails when purchase is invalid. Add tests for: unlock when purchase has expired; unlock with wrong content_id; unlock when caller is not the buyer. Validate contract reverts or returns error in each case.

**Tasks**
- Add test: unlock with expired purchase
- Add test: unlock with wrong content_id
- Add test: unlock as non-buyer
- Assert errors or panics as expected

**Acceptance Criteria**
- Expired purchase cannot unlock
- Wrong content_id cannot unlock
- Non-buyer cannot unlock
- Tests pass

---

## 5. Content-likes: pagination or cap for likes by user

**Description**  
The goal is to avoid unbounded iteration and high cost. If the contract exposes “all likes by user,” add pagination (cursor/limit) or a maximum count. Validate cost stays bounded in tests.

**Tasks**
- Add pagination params (e.g. cursor, limit) or cap to list function
- Enforce max limit in contract
- Add tests for empty list, one page, over limit

**Acceptance Criteria**
- No unbounded iteration
- Callers can page through results
- Tests pass

---

## 6. Creator-earnings: event emission for withdraw

**Description**  
The goal is to let indexers and frontends track withdrawals. Ensure withdraw emits an event with creator, amount, and token (or equivalent). Add event to contract and assert in tests.

**Tasks**
- Emit event in withdraw (creator, amount, token)
- Add test that checks event topics and data
- Keep existing withdraw behavior

**Acceptance Criteria**
- Withdraw emits event
- Event contains creator, amount, token
- Tests pass

---

## 7. Treasury: optional min balance or emergency pause

**Description**  
The goal is to protect treasury in edge cases. Add either a configurable minimum balance that blocks withdraw below threshold, or an admin-only pause flag that blocks deposit/withdraw when set. Initialize with default (e.g. no pause, min 0).

**Tasks**
- Add storage for pause flag or min_balance
- Add admin setter for pause or min_balance
- Enforce in withdraw (and deposit if pause)
- Add tests for pause and min_balance

**Acceptance Criteria**
- Admin can set pause or min_balance
- Withdraw respects min_balance or pause
- Tests pass

---

## 8. Creator-registry: rate limit or fee for registration

**Description**  
The goal is to reduce spam and abuse. Add either a per-address rate limit (e.g. one registration per N ledgers) or a small registration fee paid to treasury. Validate in tests.

**Tasks**
- Add rate limit ledger tracking or fee transfer
- Revert or reject if rate limit exceeded or fee not paid
- Add tests: same address twice within window fails; fee required if used

**Acceptance Criteria**
- Duplicate registration within window fails (or fee required)
- Tests pass

---

## 9. Social links: URL validation and domain allowlist

**Description**  
The goal is to validate social link URLs before save. Validate URL format in DTOs and service layer. Optionally allowlist allowed domains (e.g. twitter.com, instagram.com). Reject invalid or disallowed URLs with clear error.

**Tasks**
- Add URL format validation in DTO
- Add domain allowlist (config or constant)
- Reject invalid URLs in service
- Add unit tests for valid and invalid URLs

**Acceptance Criteria**
- Invalid URL format rejected
- Disallowed domain rejected
- Valid URLs accepted
- Tests pass

---

## 10. Social links: rate limiting on create/update

**Description**  
The goal is to prevent abuse of social link endpoints. Add rate limiting per user (or per IP) on create and update. Return 429 when limit exceeded. Use existing Nest guard or throttle module.

**Tasks**
- Add rate limit guard or throttle to create/update endpoints
- Configure sensible limit (e.g. N per minute)
- Return 429 and clear message when exceeded
- Add test that hits limit and gets 429

**Acceptance Criteria**
- Excess requests get 429
- Limit is per user or IP
- Tests pass

---

## 11. Subscriptions: webhook or event for renewal failure

**Description**  
The goal is to notify when a subscription renewal fails. Emit internal event or call webhook when renewal fails (payment or contract revert). Consumer can notify user or update UI. Do not block subscription flow on webhook.

**Tasks**
- Define renewal-failure event or webhook payload
- Emit or call on renewal failure in subscription flow
- Add test or manual check that event fires on failure

**Acceptance Criteria**
- Renewal failure triggers event or webhook
- Payload includes subscription id and reason if available
- Tests pass

---

## 12. Creators: search by display name or handle

**Description**  
The goal is to let users find creators by name or handle. Add search/filter by display name or handle on creators list endpoint. Support pagination and basic relevance (e.g. prefix match). Return only public fields.

**Tasks**
- Add query params for search (e.g. q, handle)
- Implement filter in repository or service
- Apply pagination to search results
- Add tests for no match, single match, pagination

**Acceptance Criteria**
- Search by name or handle works
- Results paginated
- Tests pass

---

## 13. Posts: soft delete and audit trail

**Description**  
The goal is to support moderation and audit. Implement soft delete for posts (set deleted_at and optionally deleted_by). Do not return soft-deleted posts in default list. Optionally add audit log entity for who deleted and when.

**Tasks**
- Add deleted_at (and optionally deleted_by) to post entity
- Add soft-delete endpoint (auth required)
- Filter out deleted posts in list/get unless override
- Add audit log or event for delete
- Add tests

**Acceptance Criteria**
- Post can be soft deleted
- Deleted posts excluded from default list
- Audit trail available
- Tests pass

---

## 14. Health check for Soroban RPC / contract connectivity

**Description**  
The goal is to expose backend health including chain dependency. Add health endpoint that verifies connectivity to Soroban RPC (e.g. get_ledger or read a known contract). Return 503 if RPC unreachable; 200 otherwise. Integrate with existing health module if present.

**Tasks**
- Add health check that calls RPC (or contract read)
- Set 503 on failure, 200 on success
- Add timeout to avoid blocking
- Add test or manual verification

**Acceptance Criteria**
- Health returns 503 when RPC down
- Health returns 200 when RPC up
- Tests pass

---

## 15. API versioning (e.g. /v1/...)

**Description**  
The goal is to support future breaking changes safely. Introduce URL-based API versioning (e.g. /v1/creators). Route all existing endpoints under v1. Keep default or unversioned redirecting to v1 if desired.

**Tasks**
- Add global prefix or route group for /v1
- Move or duplicate existing routes under v1
- Update any client or docs references
- Add test that v1 routes respond

**Acceptance Criteria**
- Public endpoints under /v1
- Existing behavior unchanged
- Tests pass

---

## 16. Request ID and correlation ID in logs

**Description**  
The goal is to trace requests across logs. Add middleware that generates or reads request ID (and correlation ID if from gateway). Attach to logger context and include in every log line for that request.

**Tasks**
- Add middleware to set request ID (and correlation ID)
- Attach to async context or logger
- Ensure all structured logs include request ID
- Add test or manual check

**Acceptance Criteria**
- Every request has request ID in logs
- Same ID used for full request lifecycle
- Tests pass

---

## 17. Pagination standard (cursor vs offset)

**Description**  
The goal is to standardize list APIs. Choose cursor-based or offset-based pagination and apply to subscriptions, creators, and posts list endpoints. Use consistent query params (e.g. limit, cursor or offset) and response shape (next_cursor or total).

**Tasks**
- Define standard params and response shape
- Implement cursor or offset in subscriptions list
- Implement in creators list
- Implement in posts list
- Add tests for empty, one page, next page

**Acceptance Criteria**
- All list endpoints use same pagination pattern
- Clients can page through all results
- Tests pass

---

## 18. Integration tests for wallet-related endpoints

**Description**  
The goal is to cover wallet connect/disconnect and endpoints that depend on wallet or chain. Add integration tests that call wallet-related endpoints (with mocked RPC or testnet if needed). Assert success and error paths.

**Tasks**
- Identify wallet-related endpoints
- Add integration test for connect flow
- Add integration test for disconnect or disconnect error
- Mock or use test RPC where needed

**Acceptance Criteria**
- Wallet connect path tested
- Error paths tested
- Tests pass in CI

---

## 19. Wallet: handle network mismatch (wrong chain)

**Description**  
The goal is to avoid user signing on wrong network. Detect when connected wallet is on the wrong network (e.g. not Stellar/Soroban testnet or mainnet). Show clear prompt to switch network; optionally disable actions until switched.

**Tasks**
- Detect current network from wallet
- Compare to expected network (env or config)
- Show UI prompt with expected network and switch instructions
- Optionally disable subscribe/pay until correct network

**Acceptance Criteria**
- Wrong network detected
- User sees switch prompt
- Actions blocked or warned until switched

---

## 20. Creator onboarding: progress indicator

**Description**  
The goal is to show users where they are in onboarding. Add a step-by-step progress indicator (e.g. account type → profile → social links → verification). Highlight current step; show completed and upcoming steps.

**Tasks**
- Define onboarding steps and order
- Add progress component (steps or bar)
- Wire to current route or state
- Mark steps complete when data saved

**Acceptance Criteria**
- Current step visible
- Completed steps marked
- Progress updates as user advances

---

## 21. Subscription list: filter by status

**Description**  
The goal is to let users filter their subscriptions. Add filter by status (active, expired, cancelled) and sort by expiry or creation date. Apply server-side for accuracy.

**Tasks**
- Add status filter query param
- Add sort param (expiry, created)
- Implement in backend list endpoint
- Add filter UI and sort dropdown in frontend

**Acceptance Criteria**
- User can filter by status
- User can sort by expiry or date
- Results match contract state

---

## 22. Content: lazy load images and placeholder

**Description**  
The goal is to improve performance and UX. Lazy load content images (e.g. below fold). Show placeholder or skeleton until loaded. Respect reduced motion preference where applicable.

**Tasks**
- Use lazy loading for content images
- Add placeholder or skeleton
- Optional: respect prefers-reduced-motion
- Test on slow network

**Acceptance Criteria**
- Images below fold lazy load
- Placeholder shown until load
- No layout shift or minimal

---

## 23. Error boundaries and global error UI

**Description**  
The goal is to handle React errors gracefully. Add error boundaries around main sections (e.g. layout, creator dashboard, subscription list). Show fallback UI with retry or link home. Optionally report errors.

**Tasks**
- Add error boundary component
- Wrap main route sections
- Fallback UI with retry and home link
- Add test that triggers boundary

**Acceptance Criteria**
- Uncaught error shows fallback not white screen
- User can retry or go home
- Tests pass

---

## 24. Dark/light theme and system preference

**Description**  
The goal is to support dark and light theme. Add theme toggle (dark, light, system). Persist choice (localStorage or user prefs). Apply system preference when “system” selected.

**Tasks**
- Add theme provider and CSS variables for both themes
- Add toggle (dark / light / system)
- Persist selection
- Apply system preference for system option

**Acceptance Criteria**
- User can choose dark, light, or system
- Choice persisted
- System preference applied when system

---

## 25. Responsive layout for creator dashboard

**Description**  
The goal is to make creator dashboard usable on small screens. Audit tables, forms, and stats on mobile; convert to stack or responsive table; ensure touch targets and readable text.

**Tasks**
- Audit dashboard at 320px and 768px
- Fix overflow and horizontal scroll
- Stack or collapse tables on small screens
- Ensure buttons and inputs usable

**Acceptance Criteria**
- No horizontal scroll on mobile
- All actions reachable
- Readable text and touch targets

---

## 26. Loading skeletons for lists and detail views

**Description**  
The goal is to improve perceived performance. Replace generic spinners with skeleton loaders for creator list, subscription list, and post/content detail. Match skeleton layout to final content.

**Tasks**
- Add skeleton components for list row and detail
- Use for creator list loading state
- Use for subscription list loading state
- Use for content detail loading state

**Acceptance Criteria**
- Skeletons match content layout
- Spinners replaced in main lists and detail
- No layout shift when content loads

---

## 27. A11y: focus order and keyboard navigation

**Description**  
The goal is to make main flows keyboard accessible. Review focus order and keyboard navigation for onboarding, subscribe flow, and unlock content. Ensure focus visible and trap in modals where appropriate.

**Tasks**
- Audit focus order on key pages
- Ensure all actions reachable by keyboard
- Add visible focus styles
- Trap focus in modals; restore on close

**Acceptance Criteria**
- User can complete subscribe and unlock with keyboard
- Focus order logical
- Focus visible

---

## 28. E2E tests for subscribe and unlock flow

**Description**  
The goal is to protect critical user flows. Add E2E test: connect wallet (or mock) → subscribe to a creator → unlock one piece of content. Assert UI updates and no errors.

**Tasks**
- Add E2E framework if missing (e.g. Playwright, Cypress)
- Implement test: connect → subscribe → unlock
- Use testnet or mocked RPC
- Run in CI

**Acceptance Criteria**
- E2E runs connect → subscribe → unlock
- Test passes in CI
- Flaky failures addressed

---

## 29. CI: run contract tests on every PR

**Description**  
The goal is to catch contract regressions before merge. Ensure `cargo test` (and workspace contract tests) run in CI on every PR. Fail the job if tests fail; block merge when red.

**Tasks**
- Add or update CI job to run cargo test in contract (and workspace)
- Fail job on test failure
- Require passing job for merge

**Acceptance Criteria**
- Every PR runs contract tests
- Failing tests fail CI
- Merge blocked when CI red

---

## 30. CI: cache Cargo and npm dependencies

**Description**  
The goal is to speed up CI. Configure cache for Cargo (target and registry) and npm or pnpm (node_modules). Restore cache before install; save after successful build.

**Tasks**
- Add cache step for Cargo (key: lockfile + os)
- Add cache step for npm/pnpm (key: lockfile)
- Restore before install; save after build
- Verify cache hit in logs

**Acceptance Criteria**
- Second run uses cache
- Build time reduced
- Cache invalidates on lockfile change

---

## 31. Security: dependency audit in CI

**Description**  
The goal is to catch known vulnerabilities. Run `cargo audit` and `npm audit` (or equivalent) in CI. Fail or warn on high/critical; fix or document exceptions.

**Tasks**
- Add cargo audit step (contract and backend if Rust)
- Add npm audit step (backend, frontend)
- Fail on high/critical or configure threshold
- Document and fix or suppress with comment

**Acceptance Criteria**
- CI runs audit
- High/critical cause failure or tracked issue
- No suppressed high/critical without reason

---

## 32. Logging: redact PII and secrets

**Description**  
The goal is to avoid leaking secrets and PII in logs. Ensure logs never print full tokens, private keys, or PII (email, wallet). Add redaction for sensitive fields in request/response logging.

**Tasks**
- Audit log statements for tokens and PII
- Add redaction for auth headers and body fields
- Redact wallet addresses or user ids if policy requires
- Add test or review checklist

**Acceptance Criteria**
- No full tokens or keys in logs
- PII redacted per policy
- Review or test confirms

---

## 33. Feature flags for new flows

**Description**  
The goal is to ship new flows behind flags. Introduce feature flags (env or config) for at least one new flow (e.g. new subscription or payment). Frontend and backend read flag; disable flow when flag off.

**Tasks**
- Add feature-flag config (env vars or config service)
- Add flag for one new flow
- Backend checks flag before new path
- Frontend hides or disables UI when flag off

**Acceptance Criteria**
- New flow can be toggled off
- No deploy needed to toggle
- Default safe (off or on as desired)

---

## 34. Metrics and alerting for API and RPC

**Description**  
The goal is to observe production. Add metrics for request rate, latency, and error rate for API and Soroban RPC calls. Expose via Prometheus or existing APM. Add basic alerting (e.g. error rate or latency threshold).

**Tasks**
- Add metrics for HTTP requests (count, latency, status)
- Add metrics for RPC calls (count, latency, errors)
- Expose /metrics or push to APM
- Add alert rule for high error rate or latency

**Acceptance Criteria**
- Metrics visible in dashboard
- Alert fires when threshold exceeded
- No PII in metric labels

---

## 35. Treasury: deposit event emission

**Description**  
The goal is to let indexers track deposits. Emit an event in treasury deposit with from, amount, and token (or contract address). Add test that asserts event emitted with correct data.

**Tasks**
- Emit event in deposit(from, amount)
- Include from, amount, token in event
- Add test that checks event
- Keep existing deposit behavior

**Acceptance Criteria**
- Deposit emits event
- Event has from, amount, token
- Tests pass
