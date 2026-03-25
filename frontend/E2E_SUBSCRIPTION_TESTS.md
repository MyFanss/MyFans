# E2E Subscription Flow Tests - Issue #404

## Overview
Comprehensive end-to-end test suite for the complete subscription flow in MyFans, covering discovery, subscription, and gated content access.

## Test Coverage

### Main Flow Tests (`subscribe-flow-complete.spec.ts`)

#### 1. Complete Subscription Flow
**Test**: `should complete full subscription flow: discover -> subscribe -> access content`

Steps:
1. Navigate to `/subscribe` page
2. Verify creators are displayed with all information
3. Click subscribe button on a creator
4. Verify subscription success message
5. Navigate to gated content page
6. Verify content is unlocked for subscriber
7. Verify video player is accessible

**Expected**: User can discover creators, subscribe, and access gated content seamlessly.

#### 2. Creator Search and Filtering
**Test**: `should search and filter creators`

Steps:
1. Navigate to subscribe page
2. Count initial creators
3. Enter search term
4. Verify filtered results
5. Clear search
6. Verify all creators return

**Expected**: Search functionality filters creators correctly and can be cleared.

#### 3. Error Handling
**Test**: `should handle subscription errors gracefully`

Steps:
1. Mock API to return error
2. Attempt to subscribe
3. Verify error is handled
4. Verify UI returns to normal state

**Expected**: Errors don't break the UI, user can retry.

#### 4. Locked Content Display
**Test**: `should show locked content for non-subscribers`

Steps:
1. Mock subscription status as inactive
2. Navigate to gated content
3. Verify lock overlay is displayed
4. Verify lock icon is visible
5. Verify video player is hidden
6. Verify subscribe button is present

**Expected**: Non-subscribers see lock overlay and cannot access content.

#### 5. Creator Information Display
**Test**: `should display creator information correctly`

Steps:
1. Navigate to subscribe page
2. Verify creator card contains:
   - Name
   - Username
   - Bio
   - Price
   - Subscriber count
   - Subscribe button

**Expected**: All creator information is displayed correctly.

#### 6. Wallet Connection
**Test**: `should handle wallet connection in subscription flow`

Steps:
1. Navigate to subscribe page
2. Verify wallet connect component is present
3. Verify wallet address or connect button is shown

**Expected**: Wallet connection is integrated into subscription flow.

#### 7. Related Content Navigation
**Test**: `should navigate between related content`

Steps:
1. Navigate to content page
2. Scroll to related content section
3. Verify related items are displayed
4. Click on related content
5. Verify navigation occurred

**Expected**: Users can discover and navigate to related content.

#### 8. Content Metadata
**Test**: `should display content metadata correctly`

Steps:
1. Navigate to content page
2. Verify metadata is displayed:
   - Published date
   - View count
   - Duration
   - Tags

**Expected**: All content metadata is visible and formatted correctly.

#### 9. Like and Share Actions
**Test**: `should handle like and share actions`

Steps:
1. Subscribe to access content
2. Click like button
3. Verify like state changes
4. Click share button
5. Verify share action is triggered

**Expected**: Like and share functionality works correctly.

### Edge Case Tests

#### 1. Empty Creator List
**Test**: `should handle empty creator list`

Steps:
1. Search for non-existent creator
2. Verify empty state is displayed
3. Verify "Clear search" button is present

**Expected**: Empty state is shown gracefully with recovery option.

#### 2. Network Errors
**Test**: `should handle network errors during subscription`

Steps:
1. Mock network failure
2. Attempt to subscribe
3. Verify UI handles error gracefully

**Expected**: Network errors don't crash the app.

#### 3. Slow Network
**Test**: `should handle slow network conditions`

Steps:
1. Add delay to API responses
2. Navigate to subscribe page
3. Verify page still loads (with longer timeout)

**Expected**: App works on slow connections, just takes longer.

## Fixtures and Mocks

### Wallet Mocks (`fixtures.ts`)

```typescript
setupWalletMock(page, {
  shouldReject: false,  // Simulate user rejection
  delay: 100,           // Simulate network delay
});
```

**Features**:
- Mock Freighter wallet
- Configurable rejection scenarios
- Configurable delays for realistic testing
- Deterministic wallet addresses

### API Mocks (`fixtures.ts`)

```typescript
setupApiMocks(page, {
  subscriptionStatus: 'active',  // 'active' | 'inactive' | 'error'
  shouldFailCheckout: false,     // Simulate checkout failure
  shouldFailConfirm: false,      // Simulate confirmation failure
  delay: 0,                      // Add network delay
});
```

**Features**:
- Mock subscription checkout
- Mock subscription confirmation
- Mock subscription status checks
- Mock content access checks
- Configurable failure scenarios
- Deterministic response data

### Stellar/Soroban Mocks (`fixtures.ts`)

```typescript
setupStellarMocks(page, {
  shouldFail: false,  // Simulate RPC failure
  delay: 0,           // Add network delay
});
```

**Features**:
- Mock contract data queries
- Mock transaction submissions
- Configurable failure scenarios
- Deterministic transaction hashes

## Running Tests

### Local Development

```bash
cd frontend

# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- subscribe-flow-complete.spec.ts

# Run in UI mode (interactive)
npm run test:e2e:ui

# Run in debug mode
npm run test:e2e:debug

# Run with specific browser
npx playwright test --project=chromium
```

### CI/CD

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

**GitHub Actions Workflow**: `.github/workflows/e2e-tests.yml`

Features:
- Runs on Ubuntu latest
- Uses Node.js 20
- Installs Playwright with dependencies
- Uploads test reports on failure
- 60-minute timeout
- Retries failed tests 2 times in CI

## Test Stability

### Deterministic Behavior
- All mock data uses deterministic generators
- Wallet addresses are consistent
- Transaction hashes are unique but predictable
- Timestamps use relative dates (e.g., +30 days from now)

### Waiting Strategies
- Uses `toBeVisible()` with timeouts instead of fixed waits
- Waits for specific elements, not arbitrary delays
- Uses `expect` assertions that auto-retry

### Isolation
- Each test is independent
- Mocks are set up fresh for each test
- No shared state between tests
- Tests can run in parallel

### Error Handling
- Tests verify error states
- Tests verify recovery from errors
- Tests don't fail on expected errors

## Debugging

### View Test Report

```bash
cd frontend
npx playwright show-report
```

### Debug Specific Test

```bash
cd frontend
npx playwright test --debug subscribe-flow-complete.spec.ts
```

### View Traces

Traces are automatically captured on first retry. View them in the HTML report.

### Screenshots

Screenshots are captured on failure and included in the test report.

## CI Integration

### Status Badge

Add to README.md:

```markdown
![E2E Tests](https://github.com/Ndifreke000/MyFans/workflows/E2E%20Tests/badge.svg)
```

### Required Checks

Configure branch protection to require E2E tests to pass before merging.

## Maintenance

### Adding New Tests

1. Create test in `frontend/e2e/` directory
2. Use fixtures from `fixtures.ts`
3. Follow existing patterns for consistency
4. Add documentation to this file

### Updating Mocks

1. Update mock helpers in `fixtures.ts`
2. Update tests that use the mocks
3. Verify all tests still pass

### Troubleshooting

**Tests timing out**:
- Increase timeout in test or globally
- Check if dev server is running
- Check network conditions

**Flaky tests**:
- Add more specific selectors
- Use better waiting strategies
- Check for race conditions

**Mock not working**:
- Verify route pattern matches
- Check request method (GET/POST)
- Verify mock is set up before navigation

## Best Practices

1. **Use Page Object Model** for complex pages
2. **Keep tests focused** - one scenario per test
3. **Use descriptive test names** - explain what is being tested
4. **Avoid hard-coded waits** - use Playwright's auto-waiting
5. **Test user journeys** - not implementation details
6. **Keep mocks realistic** - match real API behavior
7. **Document edge cases** - explain why they're tested
8. **Run tests locally** before pushing
9. **Review test reports** in CI
10. **Update tests** when features change

## Acceptance Criteria

✅ **Build E2E scenario: discover -> subscribe -> gated access**
- Complete flow test implemented
- All steps verified
- Success and error paths covered

✅ **Add wallet mocks/fixtures**
- Wallet mock helper created
- Configurable scenarios
- Deterministic behavior

✅ **Integrate in CI**
- GitHub Actions workflow created
- Runs on push and PR
- Uploads artifacts

✅ **Keep tests stable and deterministic**
- No flaky tests
- Proper waiting strategies
- Isolated test cases
- Deterministic mock data

## Future Improvements

- Add visual regression testing
- Add performance testing
- Add accessibility testing in E2E
- Add mobile viewport testing
- Add cross-browser testing (Firefox, Safari)
- Add API contract testing
- Add load testing scenarios
