# Requirements Document

## Introduction

The retry-banner feature improves frontend resilience in the MyFans application by surfacing a reusable, inline banner component whenever an API request fails. The banner presents the error context and a retry action directly in the UI, reducing friction for users who encounter transient failures (network errors, server errors, timeouts). The feature integrates with the existing `AppError` type system and `useTransaction` hook, and enforces deduplication so that only one banner is shown per unique failed request at any given time.

## Glossary

- **Retry_Banner**: A reusable React component that renders an inline notification containing an error message and a "Retry" button when an API request fails.
- **Request_Key**: A unique string identifier that distinguishes one API request from another (e.g. derived from endpoint + parameters). Used to prevent duplicate banners.
- **Banner_Manager**: The client-side state manager (context or hook) responsible for tracking active banners and enforcing deduplication.
- **API_Error**: An `AppError` value (as defined in `src/types/errors.ts`) produced when an API call fails.
- **Retry_Handler**: A callback function supplied to the Retry_Banner that re-executes the failed request when invoked.
- **Consumer**: Any page or component in the MyFans frontend that makes API calls and wishes to surface retry options to the user.

---

## Requirements

### Requirement 1: Retry Banner Component

**User Story:** As a fan or creator, I want to see a clear error message with a retry option when an API request fails, so that I can recover from transient failures without reloading the page.

#### Acceptance Criteria

1. THE Retry_Banner SHALL render an error message derived from the supplied `AppError.message` field.
2. THE Retry_Banner SHALL render a "Retry" button that, when activated, invokes the supplied Retry_Handler.
3. THE Retry_Banner SHALL render a dismiss button that, when activated, removes the banner from the UI without retrying.
4. WHEN the Retry_Handler is invoked and the request succeeds, THE Retry_Banner SHALL remove itself from the UI.
5. WHEN the Retry_Handler is invoked and the request fails again, THE Retry_Banner SHALL update its displayed error message to reflect the new `AppError`.
6. WHILE a retry is in progress, THE Retry_Banner SHALL display a loading indicator and disable the "Retry" button to prevent duplicate submissions.
7. THE Retry_Banner SHALL accept an optional `description` prop that, when provided, renders supplementary detail text below the primary error message.
8. THE Retry_Banner SHALL be keyboard-navigable and expose `role="alert"` so that assistive technologies announce the error automatically.

---

### Requirement 2: Deduplication of Banners

**User Story:** As a user, I want to see at most one retry banner per failed request, so that the UI does not become cluttered when the same request fails multiple times.

#### Acceptance Criteria

1. WHEN a failed request with a given Request_Key already has an active Retry_Banner, THE Banner_Manager SHALL NOT create a second banner for the same Request_Key.
2. WHEN a banner is dismissed or its associated request succeeds, THE Banner_Manager SHALL remove the entry for that Request_Key, allowing a future failure of the same request to show a new banner.
3. THE Banner_Manager SHALL support concurrent banners for distinct Request_Keys.
4. IF a Consumer registers a banner without supplying a Request_Key, THEN THE Banner_Manager SHALL treat each registration as unique and SHALL NOT apply deduplication.

---

### Requirement 3: Integration with API Error States

**User Story:** As a developer, I want the retry banner to integrate with the existing error handling infrastructure, so that I can surface retry options without duplicating error-handling logic.

#### Acceptance Criteria

1. THE Banner_Manager SHALL accept an `AppError` value (from `src/types/errors.ts`) as the error input, ensuring type compatibility with the existing error system.
2. WHEN an `AppError` with `recoverable: false` is supplied, THE Retry_Banner SHALL hide the "Retry" button and display only the error message and dismiss button.
3. THE Banner_Manager SHALL expose a `showRetryBanner(key, error, retryFn)` function that Consumers call to register a new banner.
4. THE Banner_Manager SHALL expose a `dismissBanner(key)` function that Consumers can call programmatically to remove a banner.
5. WHEN the `useTransaction` hook transitions to `state: 'failed'`, THE Consumer SHALL be able to call `showRetryBanner` with the transaction error and the hook's `retry` function without additional transformation.

---

### Requirement 4: Retry Attempt Limits

**User Story:** As a user, I want the retry banner to stop offering retries after repeated failures, so that I am not stuck in an infinite retry loop.

#### Acceptance Criteria

1. THE Retry_Banner SHALL accept a `maxRetries` prop (positive integer, default 3).
2. WHEN the number of retry attempts for a banner reaches `maxRetries`, THE Retry_Banner SHALL disable the "Retry" button and display a message indicating that the maximum number of retries has been reached.
3. THE Retry_Banner SHALL display the current attempt count (e.g. "Retry (1 / 3)") so the user can track progress.
4. IF `maxRetries` is set to 0, THEN THE Retry_Banner SHALL render without a "Retry" button, behaving as a non-retryable error notice.

---

### Requirement 5: Accessibility and Visual Design

**User Story:** As a user with assistive technology, I want the retry banner to be fully accessible, so that I can understand and act on errors regardless of how I interact with the UI.

#### Acceptance Criteria

1. THE Retry_Banner SHALL use `role="alert"` and `aria-live="assertive"` so screen readers announce the error when it appears.
2. THE Retry_Banner SHALL manage focus by moving focus to the "Retry" button when the banner first renders, unless focus is already within the banner.
3. WHEN the banner is dismissed, THE Retry_Banner SHALL return focus to the element that was focused before the banner appeared.
4. THE Retry_Banner SHALL be visually consistent with the existing error UI patterns in the application (matching the color and typography conventions used by `ErrorFallbackCompact`).
5. THE Retry_Banner SHALL be responsive and SHALL NOT overflow its container on viewports narrower than 375px.

---

### Requirement 6: Test Coverage

**User Story:** As a developer, I want the retry banner to have automated tests, so that regressions are caught before they reach production.

#### Acceptance Criteria

1. THE Test_Suite SHALL include unit tests verifying that the Retry_Banner renders the error message and "Retry" button when given a recoverable `AppError`.
2. THE Test_Suite SHALL include unit tests verifying that the Retry_Banner hides the "Retry" button when given a non-recoverable `AppError`.
3. THE Test_Suite SHALL include unit tests verifying that the Banner_Manager does not create duplicate banners for the same Request_Key.
4. THE Test_Suite SHALL include unit tests verifying that the retry attempt counter increments correctly and the "Retry" button is disabled after `maxRetries` is reached.
5. THE Test_Suite SHALL include unit tests verifying that the banner is removed from the UI after a successful retry.
6. FOR ALL valid `AppError` inputs, rendering the Retry_Banner then dismissing it then rendering it again SHALL produce a banner in the same initial state (idempotence property).
