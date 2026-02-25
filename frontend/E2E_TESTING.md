# E2E Testing Guide

## Overview

E2E tests protect critical user flows using Playwright with mocked wallet and Stellar RPC.

## Test Coverage

### Critical Flow: Connect → Subscribe → Unlock
1. Connect wallet (mocked Freighter)
2. Navigate to creator
3. Subscribe to plan
4. Unlock gated content
5. Verify no errors

## Running Tests

### Local Development
```bash
cd frontend

# Run tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug
```

### CI/CD
Tests run automatically on:
- Push to main/develop
- Pull requests

## Mocking Strategy

### Wallet Mock
- Freighter wallet is mocked in `beforeEach`
- Returns test address: `GTEST1234567890...`
- Signs transactions with `_signed` suffix

### Stellar RPC Mock
- Mocked in `fixtures.ts`
- `getContractData` returns `true` for subscriptions
- `submitTransaction` returns mock hash

### Backend API Mock
- Checkout endpoints return mock data
- Confirm returns success

## Test Structure

```
frontend/
├── e2e/
│   ├── subscription-flow.spec.ts  # Main flow test
│   └── fixtures.ts                # Mock setup
├── playwright.config.ts           # Playwright config
└── package.json                   # Test scripts
```

## Flaky Test Prevention

1. **Explicit waits**: Use `timeout` options
2. **Retry logic**: 2 retries in CI
3. **Stable selectors**: Use `data-testid` attributes
4. **Mock consistency**: Fixed responses
5. **Single worker in CI**: Prevents race conditions

## Adding Test IDs

Add to components for stable selectors:

```tsx
// Creator card
<div data-testid="creator-card">

// Plan card
<div data-testid="plan-card">

// Content viewer
<div data-testid="content-viewer">

// Locked content
<div data-testid="locked-content">

// Subscription item
<div data-testid="subscription-item">
```

## CI Configuration

See `.github/workflows/e2e.yml`:
- Runs on Ubuntu
- PostgreSQL service
- Backend starts first
- Frontend with Playwright
- Uploads test reports

## Debugging Failed Tests

```bash
# View last test report
npx playwright show-report

# Run specific test
npx playwright test subscription-flow

# Run in headed mode
npx playwright test --headed

# Step through test
npx playwright test --debug
```

## Acceptance Criteria ✅

- [x] E2E runs connect → subscribe → unlock
- [x] Test passes in CI
- [x] Flaky failures addressed with retries and stable selectors
- [x] Mocked wallet and RPC for consistent results
- [x] Test reports uploaded as artifacts
