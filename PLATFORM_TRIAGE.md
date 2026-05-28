# MyFans Platform Triage & PR Breakdown

**Last Updated**: April 22, 2026  
**Status**: Active Triage  
**Maintainer**: Platform Team  
**Source**: ISSUES.md backlog + TODO.md in-progress work

---

## Overview

This document provides a structured breakdown of the MyFans backlog into sensible, reviewable PRs. Each PR is scoped to be:
- **Reviewable**: <400 lines of code changes (excluding tests)
- **Reversible**: Single feature or fix, no cross-cutting concerns
- **Testable**: Includes unit/integration tests or clear manual checklist
- **Documented**: Updates relevant docs or adds inline comments
- **Coordinated**: Identifies cross-layer dependencies (frontend/backend/contracts)
- **Verifiable**: CI checks + manual checklist for good-first-issues

---

## Triage Categories

### 1. **Blocking** (Unblocks other work, must do first)
### 2. **Critical** (Core functionality gaps, high impact)
### 3. **High Priority** (Improves reliability/security)
### 4. **Good-First-Issues** (Real tasks, onboarding for new contributors)
### 5. **Medium Priority** (UX/polish improvements)
### 6. **Technical Debt** (Refactoring/cleanup)

---

## CRITICAL PATH

### PR-001: GitHub Actions CI/CD Workflow
**Status**: 🔴 BLOCKED  
**Scope**: DevOps / Infrastructure  
**Layers**: All (frontend, backend, contracts)

**Description**  
The CI/CD pipeline is missing. Referenced in docs but `.github/workflows/ci.yml` does not exist. This blocks all other work from being verified in CI.

**Tasks**
- [ ] Create `.github/workflows/ci.yml` with:
  - TypeScript type checking (backend + frontend)
  - ESLint + Prettier formatting checks
  - Backend: Jest unit tests + E2E tests
  - Frontend: Vitest unit tests + Playwright E2E tests
  - Contracts: `cargo test` for all workspace members
  - Build verification (backend, frontend, contracts)
  - Dependency audit (`npm audit`, `cargo audit`)
- [ ] Add workflow status badge to README.md
- [ ] Document CI requirements in DEPLOYMENT.md

**Acceptance Criteria**
- ✅ All checks pass on main branch
- ✅ PR blocks merge if any check fails
- ✅ Workflow runs on: push to main, all PRs, manual trigger
- ✅ Estimated runtime: <15 minutes

**Documentation**
- Update: `DEPLOYMENT.md` → Add "CI/CD Pipeline" section
- Add: `.github/workflows/README.md` → Explain each job

**Testing**
- Manual: Push to feature branch, verify all checks run
- Checklist: All jobs complete successfully

**Coordination**: None (infrastructure-only)

---

### PR-002: Contract Authorization Tests (Treasury)
**Status**: 🟡 READY  
**Scope**: Smart Contracts / Testing  
**Layers**: Contracts only

**Description**  
Treasury contract lacks proper authorization tests using `mock_auths`. Currently uses `mock_all_auths` which doesn't validate specific signer requirements. Add tests that verify:
- `initialize` requires admin
- `deposit` requires `from` signer
- `withdraw` requires admin
- Unauthorized calls revert

**Tasks**
- [ ] Add `test_treasury_auth_initialize` - verify admin-only init
- [ ] Add `test_treasury_auth_deposit` - verify `from` signer required
- [ ] Add `test_treasury_auth_withdraw_unauthorized` - non-admin reverts
- [ ] Use `mock_auths(&[MockAuth { ... }])` instead of `mock_all_auths`
- [ ] Reference: `contract/src/treasury/test.rs` and `AUTH_MATRIX.md`

**Acceptance Criteria**
- ✅ All three tests pass
- ✅ No `mock_all_auths` in auth-specific tests
- ✅ Unauthorized withdraw returns error (not panic)
- ✅ `cargo test --package treasury` passes

**Documentation**
- Update: `contract/AUTH_MATRIX.md` → Add treasury section with test examples
- Add: Inline comments in test file explaining `mock_auths` usage

**Testing**
- Unit: `cargo test --package treasury`
- Manual: Review test output for auth failures

**Coordination**: None (contract-only)

---

### PR-003: Creator-Deposits Unauthorized Withdraw Test
**Status**: 🟡 READY  
**Scope**: Smart Contracts / Testing  
**Layers**: Contracts only

**Description**  
Creator-deposits contract needs test verifying only creator (or admin) can withdraw. Add test that:
- Registers creator and deposits funds
- Attempts withdraw as non-creator address
- Asserts error (not panic)
- Verifies stake unchanged

**Tasks**
- [ ] Add `test_unauthorized_withdraw_reverts` in `contract/src/creator-deposits/test.rs`
- [ ] Setup: register creator, deposit amount
- [ ] Call `try_withdraw` as different address
- [ ] Assert error code matches authorization failure
- [ ] Verify deposit amount unchanged

**Acceptance Criteria**
- ✅ Non-creator cannot withdraw
- ✅ Deposit amount unchanged after failed attempt
- ✅ Test passes in CI
- ✅ Error message is clear (not generic panic)

**Documentation**
- Update: `contract/AUTH_MATRIX.md` → Add creator-deposits section
- Reference: Treasury test pattern from PR-002

**Testing**
- Unit: `cargo test --package creator-deposits`
- Manual: Verify error type matches expected auth failure

**Coordination**: None (contract-only)

---

### PR-004: Subscription Contract Snapshot/Restore Tests
**Status**: 🟡 READY  
**Scope**: Smart Contracts / Testing  
**Layers**: Contracts only

**Description**  
Subscription contract needs state consistency tests using `env.to_snapshot()` and `env.from_snapshot()`. Verify:
- Subscription data persists across snapshot/restore
- Plan, expiry, and fan address are correct after restore
- Cancel operation works correctly after restore

**Tasks**
- [ ] Add `test_subscription_snapshot_restore` in `contract/src/subscription/test.rs`
- [ ] Create subscription, call `env.to_snapshot()`
- [ ] Restore with `env.from_snapshot()`
- [ ] Assert plan_id, expiry_ledger, fan match original
- [ ] Add `test_cancel_after_restore` - cancel after restore, verify state
- [ ] Check joined_players/counts if applicable

**Acceptance Criteria**
- ✅ Snapshot captures all subscription fields
- ✅ Restore returns identical state
- ✅ Cancel after restore works correctly
- ✅ All tests pass: `cargo test --package subscription`

**Documentation**
- Add: Inline comments explaining snapshot/restore pattern
- Reference: Soroban SDK docs on state testing

**Testing**
- Unit: `cargo test --package subscription`
- Manual: Verify snapshot/restore cycle

**Coordination**: None (contract-only)

---

## HIGH PRIORITY

### PR-005: Subscription Event Indexer Implementation
**Status**: 🟡 READY  
**Scope**: Backend / Indexing  
**Layers**: Backend + Contracts

**Description**  
Subscription event indexer is skeleton-only (TODO.md). Implement full event polling from Soroban RPC:
- Poll subscription contract for events (subscribe, renew, cancel)
- Parse events and store in database
- Update subscription state in backend
- Handle missed events on restart

**Tasks**
- [ ] Implement `SubscriptionEventPoller` service
- [ ] Add event types: `SubscriptionCreated`, `SubscriptionRenewed`, `SubscriptionCancelled`
- [ ] Implement polling loop with configurable interval (default: 10s)
- [ ] Add database schema for event log (contract_event_id, event_type, data, processed_at)
- [ ] Handle duplicate events (idempotency key)
- [ ] Add error handling and retry logic
- [ ] Integrate with existing subscription service

**Acceptance Criteria**
- ✅ Events polled from Soroban RPC every 10 seconds
- ✅ Subscription state updated in database
- ✅ Duplicate events ignored (idempotency)
- ✅ Missed events recovered on service restart
- ✅ E2E test: subscribe on-chain → event indexed → backend state updated

**Documentation**
- Add: `backend/docs/EVENT_INDEXING.md` → Explain polling strategy, event types, error handling
- Update: `INTEGRATION.md` → Add event flow diagram
- Add: Inline comments in poller service

**Testing**
- Unit: Mock Soroban RPC, verify event parsing
- Integration: Real testnet subscription → verify indexing
- E2E: Full flow from wallet → contract → backend

**Coordination**: 
- **Contracts**: Verify event emission in subscription contract
- **Frontend**: No changes needed (backend-driven)

---

### PR-006: Content Access Unlock Validation Tests
**Status**: 🟡 READY  
**Scope**: Smart Contracts / Testing  
**Layers**: Contracts only

**Description**  
Content-access contract needs tests for expired/invalid unlock scenarios:
- Unlock fails if subscription expired
- Unlock fails if subscription cancelled
- Unlock succeeds if subscription active
- Unlock fails if wrong creator

**Tasks**
- [ ] Add `test_unlock_expired_subscription_fails`
- [ ] Add `test_unlock_cancelled_subscription_fails`
- [ ] Add `test_unlock_active_subscription_succeeds`
- [ ] Add `test_unlock_wrong_creator_fails`
- [ ] Use mock_auths for proper auth testing

**Acceptance Criteria**
- ✅ All four tests pass
- ✅ Expired/cancelled subscriptions cannot unlock
- ✅ Active subscriptions unlock successfully
- ✅ Wrong creator cannot unlock

**Documentation**
- Update: `contract/AUTH_MATRIX.md` → Add content-access section
- Add: Inline comments explaining unlock validation

**Testing**
- Unit: `cargo test --package content-access`

**Coordination**: None (contract-only)

---

### PR-007: Pagination Standardization Across APIs
**Status**: 🟡 READY  
**Scope**: Backend / API Design  
**Layers**: Backend only

**Description**  
Inconsistent pagination across endpoints. Standardize to:
- Query params: `page` (1-indexed), `limit` (default 20, max 100)
- Response: `data[]`, `pagination: { page, limit, total, hasMore }`
- Apply to: creators, content, comments, posts, subscriptions

**Tasks**
- [ ] Create `PaginationDto` and `PaginatedResponse<T>` in `common/dto`
- [ ] Update endpoints:
  - `GET /creators` → paginated
  - `GET /creators/:id/content` → paginated
  - `GET /content/:id/comments` → paginated
  - `GET /posts` → paginated
  - `GET /subscriptions` → paginated
- [ ] Add validation: `page >= 1`, `limit <= 100`
- [ ] Update OpenAPI/Swagger docs
- [ ] Add tests for pagination edge cases

**Acceptance Criteria**
- ✅ All listed endpoints use standard pagination
- ✅ Response format consistent across all endpoints
- ✅ Validation prevents invalid page/limit
- ✅ Tests cover: first page, middle page, last page, edge cases

**Documentation**
- Add: `backend/docs/API_PAGINATION.md` → Standard format, examples
- Update: OpenAPI spec with pagination schema
- Update: `INTEGRATION.md` → Add pagination examples

**Testing**
- Unit: Pagination DTO validation
- Integration: Test each endpoint with various page/limit values
- E2E: Verify response format consistency

**Coordination**: None (backend-only)

---

### PR-008: Wallet Network Mismatch Detection
**Status**: 🟡 READY  
**Scope**: Frontend / Auth  
**Layers**: Frontend + Backend

**Description**  
Frontend doesn't detect when wallet is connected to wrong network (e.g., mainnet vs testnet). Add:
- Detect wallet network on connect
- Compare with backend's configured network
- Show error if mismatch
- Provide switch network button

**Tasks**
- [ ] Add network detection in wallet connection hook
- [ ] Add `NEXT_PUBLIC_STELLAR_NETWORK` env var (testnet/mainnet)
- [ ] Add error boundary for network mismatch
- [ ] Show modal: "Switch to [network]" with button
- [ ] Add backend endpoint: `GET /config/network` → returns configured network
- [ ] Add tests for network detection

**Acceptance Criteria**
- ✅ Network mismatch detected on wallet connect
- ✅ User sees clear error message
- ✅ Switch network button works (opens Freighter settings)
- ✅ No API calls made if network mismatched

**Documentation**
- Add: `frontend/docs/WALLET_SETUP.md` → Network configuration
- Update: `.env.local.example` → Add NEXT_PUBLIC_STELLAR_NETWORK

**Testing**
- Unit: Network detection logic
- Manual: Connect wallet to wrong network, verify error
- E2E: Wallet connect flow with network validation

**Coordination**: 
- **Backend**: Add `/config/network` endpoint
- **Contracts**: No changes needed

---

## MEDIUM PRIORITY

### PR-009: Rate Limiting on Social Links Endpoint
**Status**: 🟡 READY  
**Scope**: Backend / Security  
**Layers**: Backend only

**Description**  
Social links endpoint lacks rate limiting. Add throttling to prevent abuse:
- `POST /creators/:id/social-links` → 10 requests/minute per user
- `DELETE /creators/:id/social-links/:linkId` → 10 requests/minute per user
- Use existing throttler guard

**Tasks**
- [ ] Apply `@Throttle(10, 60)` to social links endpoints
- [ ] Add custom throttle key (user ID, not IP)
- [ ] Add tests for rate limit behavior
- [ ] Document rate limits in API docs

**Acceptance Criteria**
- ✅ Endpoints throttled to 10 req/min
- ✅ 11th request returns 429 Too Many Requests
- ✅ Tests verify throttling behavior

**Documentation**
- Update: `backend/docs/RATE_LIMITING.md` → Add social links limits
- Update: OpenAPI spec with rate limit headers

**Testing**
- Unit: Throttle guard behavior
- Integration: Make 11 requests, verify 429 on 11th

**Coordination**: None (backend-only)

---

### PR-010: Soft Delete for Posts
**Status**: 🟡 READY  
**Scope**: Backend / Data Integrity  
**Layers**: Backend only

**Description**  
Posts are hard-deleted, losing audit trail. Implement soft delete:
- Add `deletedAt` column to posts table
- Update queries to exclude soft-deleted posts
- Add admin endpoint to view deleted posts
- Add recovery endpoint (restore deleted post)

**Tasks**
- [ ] Create migration: add `deletedAt` column to posts
- [ ] Update `Post` entity with `@DeleteDateColumn()`
- [ ] Update all post queries to exclude soft-deleted
- [ ] Add `DELETE /posts/:id` → soft delete
- [ ] Add `POST /admin/posts/:id/restore` → restore deleted post
- [ ] Add tests for soft delete behavior

**Acceptance Criteria**
- ✅ Deleted posts not visible in normal queries
- ✅ Admin can view deleted posts
- ✅ Deleted posts can be restored
- ✅ Audit trail preserved

**Documentation**
- Add: Inline comments explaining soft delete pattern
- Update: `backend/docs/DATA_INTEGRITY.md` → Soft delete strategy

**Testing**
- Unit: Soft delete query behavior
- Integration: Delete post, verify not in list, restore, verify visible

**Coordination**: None (backend-only)

---

### PR-011: Request Correlation IDs for Logging
**Status**: 🟡 READY  
**Scope**: Backend / Observability  
**Layers**: Backend only

**Description**  
Logs lack correlation IDs, making it hard to trace requests. Add:
- Generate unique correlation ID per request
- Include in all logs for that request
- Return in response headers
- Use for error tracking

**Tasks**
- [ ] Create correlation ID middleware
- [ ] Generate UUID per request (or use X-Request-ID header if provided)
- [ ] Add to Winston logger context
- [ ] Include in response headers: `X-Correlation-ID`
- [ ] Update error responses to include correlation ID
- [ ] Add tests for correlation ID propagation

**Acceptance Criteria**
- ✅ Every request has unique correlation ID
- ✅ ID included in all logs for that request
- ✅ ID returned in response headers
- ✅ Error responses include correlation ID

**Documentation**
- Add: `backend/docs/LOGGING.md` → Correlation ID usage
- Update: Error response examples in API docs

**Testing**
- Unit: Correlation ID generation
- Integration: Make request, verify ID in logs and headers

**Coordination**: None (backend-only)

---

### PR-012: E2E Tests for Critical Flows
**Status**: 🟡 READY  
**Scope**: Frontend / Testing  
**Layers**: Frontend + Backend + Contracts

**Description**  
Missing E2E tests for critical user flows. Add Playwright tests for:
- Creator onboarding → create subscription plan
- Fan discovery → subscribe to creator
- Fan unlock → view gated content
- Subscription renewal

**Tasks**
- [ ] Add `tests/e2e/creator-onboarding.spec.ts`
- [ ] Add `tests/e2e/fan-subscribe.spec.ts`
- [ ] Add `tests/e2e/content-unlock.spec.ts`
- [ ] Add `tests/e2e/subscription-renewal.spec.ts`
- [ ] Use testnet for E2E tests
- [ ] Mock wallet interactions where needed

**Acceptance Criteria**
- ✅ All four flows tested end-to-end
- ✅ Tests pass on testnet
- ✅ Tests are stable (no flakiness)
- ✅ CI runs E2E tests

**Documentation**
- Add: `frontend/docs/E2E_TESTING.md` → How to run E2E tests
- Add: Inline comments explaining test setup

**Testing**
- E2E: `npm run test:e2e`
- Manual: Run flows manually to verify

**Coordination**: 
- **Backend**: Ensure testnet endpoints available
- **Contracts**: Ensure testnet contracts deployed

---

## GOOD-FIRST-ISSUES

### PR-013: Dark/Light Theme Toggle
**Status**: 🟢 GOOD-FIRST-ISSUE  
**Scope**: Frontend / UI  
**Layers**: Frontend only  
**Difficulty**: Easy

**Description**  
Add dark/light theme toggle to settings. No backend changes needed.

**Tasks**
- [ ] Add theme context using `next-themes`
- [ ] Add theme toggle button in settings
- [ ] Apply Tailwind dark mode classes
- [ ] Persist theme preference to localStorage
- [ ] Add tests for theme switching

**Acceptance Criteria**
- ✅ Theme toggle works
- ✅ Theme persists on page reload
- ✅ All pages respect theme
- ✅ Tests pass

**Documentation**
- Add: Inline comments explaining theme setup

**Testing**
- Manual: Toggle theme, reload page, verify persistence

**Coordination**: None (frontend-only)

---

### PR-014: Loading Skeletons for Content
**Status**: 🟢 GOOD-FIRST-ISSUE  
**Scope**: Frontend / UX  
**Layers**: Frontend only  
**Difficulty**: Easy

**Description**  
Add loading skeleton components for perceived performance improvement.

**Tasks**
- [ ] Create `Skeleton` component (reusable)
- [ ] Add skeletons to:
  - Creator card loading
  - Content card loading
  - Subscription list loading
- [ ] Use Tailwind for styling
- [ ] Add tests for skeleton rendering

**Acceptance Criteria**
- ✅ Skeletons display while loading
- ✅ Skeletons replaced with content when loaded
- ✅ Consistent styling across app

**Documentation**
- Add: Storybook story for Skeleton component

**Testing**
- Manual: Verify skeletons appear during loading

**Coordination**: None (frontend-only)

---

### PR-015: Keyboard Navigation for Modals
**Status**: 🟢 GOOD-FIRST-ISSUE  
**Scope**: Frontend / Accessibility  
**Layers**: Frontend only  
**Difficulty**: Easy

**Description**  
Add keyboard navigation to modals (Tab, Escape, Enter).

**Tasks**
- [ ] Add Escape key handler to close modal
- [ ] Add Tab key focus management (trap focus in modal)
- [ ] Add Enter key to confirm actions
- [ ] Add tests for keyboard navigation

**Acceptance Criteria**
- ✅ Escape closes modal
- ✅ Tab cycles through focusable elements
- ✅ Focus trapped in modal
- ✅ Enter confirms action

**Documentation**
- Add: Accessibility guidelines in frontend docs

**Testing**
- Manual: Test keyboard navigation in modals

**Coordination**: None (frontend-only)

---

### PR-016: Lazy Load Images
**Status**: 🟢 GOOD-FIRST-ISSUE  
**Scope**: Frontend / Performance  
**Layers**: Frontend only  
**Difficulty**: Easy

**Description**  
Lazy load images to improve page load performance.

**Tasks**
- [ ] Add `loading="lazy"` to `<img>` tags
- [ ] Or use `next/image` with `loading="lazy"`
- [ ] Add placeholder blur while loading
- [ ] Add tests for lazy loading

**Acceptance Criteria**
- ✅ Images lazy loaded
- ✅ Placeholder shown while loading
- ✅ No performance regression

**Documentation**
- Add: Image optimization guidelines

**Testing**
- Manual: Verify images load on scroll

**Coordination**: None (frontend-only)

---

### PR-017: Creator Search Functionality
**Status**: 🟡 READY  
**Scope**: Backend + Frontend / Discovery  
**Layers**: Backend + Frontend  
**Difficulty**: Medium

**Description**  
Add search functionality to discover creators by name/bio.

**Tasks**
- [ ] Backend: Add `GET /creators/search?q=query` endpoint
- [ ] Backend: Implement full-text search on creator name/bio
- [ ] Frontend: Add search input to discover page
- [ ] Frontend: Display search results with pagination
- [ ] Add tests for search functionality

**Acceptance Criteria**
- ✅ Search returns matching creators
- ✅ Results paginated
- ✅ Search case-insensitive
- ✅ Performance acceptable (<500ms)

**Documentation**
- Update: `INTEGRATION.md` → Add search endpoint docs

**Testing**
- Unit: Search query parsing
- Integration: Search with various queries
- E2E: Search flow in UI

**Coordination**: 
- **Frontend**: Implement search UI
- **Backend**: Implement search endpoint

---

## TECHNICAL DEBT

### PR-018: Dependency Audit in CI
**Status**: 🟡 READY  
**Scope**: DevOps / Security  
**Layers**: All

**Description**  
Add dependency audit to CI pipeline to catch security vulnerabilities.

**Tasks**
- [ ] Add `npm audit` to backend CI job
- [ ] Add `npm audit` to frontend CI job
- [ ] Add `cargo audit` to contract CI job
- [ ] Fail CI if vulnerabilities found
- [ ] Document how to fix vulnerabilities

**Acceptance Criteria**
- ✅ CI runs dependency audit
- ✅ CI fails if vulnerabilities found
- ✅ Clear error messages

**Documentation**
- Add: `DEPLOYMENT.md` → Dependency audit section

**Testing**
- Manual: Verify audit runs in CI

**Coordination**: None (infrastructure-only)

---

### PR-019: TypeScript Strict Mode
**Status**: 🟡 READY  
**Scope**: Backend / Code Quality  
**Layers**: Backend

**Description**  
Enable TypeScript strict mode to catch more errors at compile time.

**Tasks**
- [ ] Update `tsconfig.json`: `"strict": true`
- [ ] Fix all type errors
- [ ] Add tests for type safety

**Acceptance Criteria**
- ✅ TypeScript strict mode enabled
- ✅ No type errors
- ✅ All tests pass

**Documentation**
- Add: Inline comments for complex types

**Testing**
- Unit: `npm run build` passes

**Coordination**: None (backend-only)

---

## ACCEPTANCE CRITERIA CHECKLIST

For each PR, verify:

- [ ] **Code Quality**
  - [ ] Follows project style guide (ESLint, Prettier)
  - [ ] No console.log or debug code
  - [ ] Proper error handling
  - [ ] No hardcoded values

- [ ] **Testing**
  - [ ] Unit tests added/updated
  - [ ] Integration tests if applicable
  - [ ] E2E tests if user-facing
  - [ ] All tests pass locally and in CI

- [ ] **Documentation**
  - [ ] README/docs updated if needed
  - [ ] Inline comments for complex logic
  - [ ] API docs updated (if backend)
  - [ ] Migration guide if breaking changes

- [ ] **Coordination**
  - [ ] Cross-layer dependencies identified
  - [ ] Stakeholders notified
  - [ ] No conflicts with in-flight PRs

- [ ] **Reviewability**
  - [ ] <400 lines of code changes
  - [ ] Single feature/fix per PR
  - [ ] Clear commit messages
  - [ ] No unrelated changes

---

## PR WORKFLOW

1. **Pick a PR** from this document
2. **Create feature branch**: `git checkout -b feature/pr-XXX-description`
3. **Implement changes** following acceptance criteria
4. **Run tests locally**: `npm test`, `cargo test`, etc.
5. **Update docs** as specified
6. **Create PR** with:
   - Title: `[PR-XXX] Description`
   - Description: Link to this document + checklist
   - Labels: category (backend, frontend, contracts, devops)
7. **Address review feedback**
8. **Merge** when all checks pass

---

## Stakeholder Sign-Off

- [ ] **Frontend Lead**: Reviewed frontend PRs
- [ ] **Backend Lead**: Reviewed backend PRs
- [ ] **Contract Lead**: Reviewed contract PRs
- [ ] **DevOps Lead**: Reviewed infrastructure PRs

---

## Metrics

| Metric | Target | Current |
|--------|--------|---------|
| PR Review Time | <24 hours | TBD |
| Test Coverage | >80% | TBD |
| CI Pass Rate | >95% | TBD |
| Good-First-Issues Assigned | 5+ | 0 |

---

## Questions?

Refer to:
- Architecture: `README.md`
- Setup: `QUICKSTART.md`
- Deployment: `DEPLOYMENT.md`
- Integration: `INTEGRATION.md`
- Contracts: `contract/README.md`

