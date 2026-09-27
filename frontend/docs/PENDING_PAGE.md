# Pending Page

## Decision

The pending page is **removed from production builds**. It is only available in
development and preview builds, where it renders real pending checkouts and
transactions fetched from the pending API.

This decision resolves issue #1836: fake pending items destroy support trust, so
no fabricated pending rows (and no fabricated transaction hashes) may ever be
shown in a production build.

## Why

- Support and users must be able to trust every row shown on the pending page.
- Fabricated hashes are a security and trust hazard; we never invent hashes.
- The pending API is not yet reliable enough to be a production surface, so the
  page is gated out of production rather than shipped with placeholder data.

## Behavior

### Production builds

- The pending route is not registered and the pending page is not rendered.
- Navigating to the pending route falls through to the normal not-found flow.
- No pending API calls are made and no pending rows are fabricated.

### Development / preview builds

- The pending page renders only items returned by the pending API.
- If the API returns no pending items, an explicit empty state is shown
  ("No pending checkouts or transactions").
- If the API fails, an explicit error state with a retry action is shown. We do
  not fall back to fabricated data.

## Stuck pending UX and timeouts

- Each pending item shows the time it has been pending.
- Items pending longer than the configured timeout are flagged as "stuck" with a
  clear explanation and a link to support.
- The pending list is polled on an interval; polling stops when the page is
  unmounted or the tab is hidden, and resumes on focus.
- A request timeout surfaces the error state instead of leaving the page in a
  permanent loading state.

## Security considerations

- No fabricated transaction hashes are ever generated or displayed.
- Only hashes returned by the pending API are rendered.
- The page is unreachable in production builds, so it cannot leak placeholder
  data to end users.

## Verification

- Build assertion: production builds must not include the pending page route or
  its placeholder data. This is covered by the demo-route check in CI.
- e2e (dev/preview): the pending page shows real API items, an empty state when
  there are none, and an error state on API failure.

## Out of scope

- Cross-device sync of pending items.
