# Implementation Plan: Subscribe Confirmation UI

## Overview

Implement the subscribe confirmation flow as a Next.js App Router page + React component tree, wiring together wallet connection, Soroban transaction building/signing, on-chain polling, and error recovery using existing hooks and lib utilities.

## Tasks

- [x] 1. Define shared types and extend stellar.ts
  - Add `SubscriptionPlan`, `FlowState`, `TxPollStatus`, and `TransactionPollResult` TypeScript interfaces/types to `src/types/subscribe.ts`
  - Extend `src/lib/stellar.ts` with `checkTransactionStatus(txHash: string): Promise<'pending' | 'confirmed' | 'failed'>` that queries Horizon `GET /transactions/{hash}`
  - _Requirements: 1.1, 2.1, 3.1_

- [x] 2. Implement `useTransactionPoller` hook
  - [x] 2.1 Create `src/hooks/useTransactionPoller.ts`
    - Poll `checkTransactionStatus` at ≤3 s intervals using `setInterval`
    - Stop on `confirmed`, `failed`, or after 60 000 ms (emit `timeout`)
    - Return `{ status: TxPollStatus, txHash: string, elapsedMs: number }`
    - _Requirements: 3.1, 3.5_

  - [ ]* 2.2 Write property test for polling interval (Property 6)
    - **Property 6: Polling interval is at most 3 seconds**
    - **Validates: Requirements 3.1**

  - [ ]* 2.3 Write property test for polling timeout (Property 7)
    - **Property 7: Polling timeout triggers error after 60 seconds**
    - **Validates: Requirements 3.5**

- [x] 3. Implement `useSubscribeFlow` hook
  - [x] 3.1 Create `src/hooks/useSubscribeFlow.ts`
    - Orchestrate `buildSubscriptionTx` → `signTransaction` → `submitTransaction` → `useTransactionPoller` sequence
    - Manage `FlowState` transitions per the state transition table in the design
    - Implement automatic retry (max 3) for network-class errors
    - Return `{ state, execute, retry, reset }`
    - _Requirements: 2.1, 2.2, 2.4, 4.1, 5.5_

  - [ ]* 3.2 Write property test for build-sign-submit sequence (Property 3)
    - **Property 3: Build-sign-submit sequence uses correct arguments**
    - **Validates: Requirements 2.1, 2.2, 2.4**

  - [ ]* 3.3 Write property test for rejection not calling submitTransaction (Property 4)
    - **Property 4: Rejection does not call submitTransaction**
    - **Validates: Requirements 4.1**

  - [ ]* 3.4 Write property test for automatic retry cap (Property 11)
    - **Property 11: Automatic retry is capped at 3 attempts**
    - **Validates: Requirements 5.5**

- [ ] 4. Checkpoint — Ensure all hook tests pass, ask the user if questions arise.

- [x] 5. Implement `WalletGate` component
  - [x] 5.1 Create `src/components/subscribe/WalletGate.tsx`
    - Use `isWalletInstalled()` from `wallet.ts` to branch between install prompt and connect button
    - Install prompt includes link to `https://freighter.app`
    - On connect success call `onConnected` prop to transition flow to `confirmation`
    - _Requirements: 6.1, 6.3_

  - [ ]* 5.2 Write unit tests for `WalletGate`
    - Test install link rendered when `isWalletInstalled()` returns `false`
    - Test connect button rendered when installed but not connected
    - _Requirements: 6.1, 6.3_

- [x] 6. Implement `ConfirmationScreen` component
  - [x] 6.1 Create `src/components/subscribe/ConfirmationScreen.tsx`
    - Display creator name, plan name, price, currency, billing interval, and connected wallet address
    - Render "Sign & Subscribe" (primary) and "Cancel" (secondary) buttons
    - Accept `disabled` prop; pass it to "Sign & Subscribe" button
    - _Requirements: 1.1, 1.2, 1.3, 6.2_

  - [ ]* 6.2 Write property test for plan fields rendered (Property 1)
    - **Property 1: Confirmation screen displays all required plan fields**
    - **Validates: Requirements 1.1**

  - [ ]* 6.3 Write property test for wallet address visible (Property 12)
    - **Property 12: Wallet address is visible on the confirmation screen after connection**
    - **Validates: Requirements 6.2**

  - [ ]* 6.4 Write unit tests for `ConfirmationScreen`
    - Test "Sign & Subscribe" and "Cancel" buttons are present
    - _Requirements: 1.2, 1.3_

- [x] 7. Implement status indicator components
  - [x] 7.1 Create `src/components/subscribe/SigningStatusIndicator.tsx`
    - Display "Waiting for wallet approval…" with a spinner
    - _Requirements: 2.3_

  - [x] 7.2 Create `src/components/subscribe/PollingStatusIndicator.tsx`
    - Display "Confirming your subscription on-chain…" with a progress indicator
    - _Requirements: 3.2_

- [x] 8. Implement `SubscribeSuccessView` component
  - [x] 8.1 Create `src/components/subscribe/SubscribeSuccessView.tsx`
    - Display creator name and "You are now subscribed"
    - Render a navigation CTA to the creator's gated content
    - _Requirements: 3.3, 3.4_

  - [ ]* 8.2 Write property test for success state content (Property 8)
    - **Property 8: Success state shows creator name and subscribed message**
    - **Validates: Requirements 3.3**

  - [ ]* 8.3 Write unit test for navigation CTA in success state
    - _Requirements: 3.4_

- [x] 9. Implement `SubscribeConfirmationFlow` top-level component
  - [x] 9.1 Create `src/components/subscribe/SubscribeConfirmationFlow.tsx`
    - Own `FlowState`; render `WalletGate`, `ConfirmationScreen`, `SigningStatusIndicator`, `PollingStatusIndicator`, `SubscribeSuccessView`, or `TxFailureRecovery` based on current step
    - Pass `disabled={step !== 'confirmation'}` to `ConfirmationScreen` "Sign & Subscribe" button
    - Wire `useSubscribeFlow` to the "Sign & Subscribe" click handler
    - Accept `creatorId`, `planId`, `onSuccess`, `onCancel` props
    - _Requirements: 1.4, 2.3, 3.2, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4_

  - [ ]* 9.2 Write property test for button disabled in in-progress states (Property 2)
    - **Property 2: "Sign & Subscribe" is disabled while flow is in progress**
    - **Validates: Requirements 1.4**

  - [ ]* 9.3 Write property test for rejection copy only for TX_REJECTED (Property 5)
    - **Property 5: Rejection error state shows correct copy and is distinguished from other wallet errors**
    - **Validates: Requirements 4.2, 4.4**

  - [ ]* 9.4 Write property test for network error headline and retry (Property 9)
    - **Property 9: Network error state shows correct headline and retry action**
    - **Validates: Requirements 5.1**

  - [ ]* 9.5 Write property test for no-funds-deducted in pre-submission errors (Property 10)
    - **Property 10: No-funds-deducted message appears in all pre-submission error states**
    - **Validates: Requirements 5.4**

  - [ ]* 9.6 Write unit tests for `SubscribeConfirmationFlow` states
    - Test "Waiting for wallet approval" shown during `awaiting-signature`
    - Test polling message shown during `polling`
    - Test rejection error renders "Try again" and "Go back" buttons
    - Test insufficient balance headline
    - Test network congestion headline
    - _Requirements: 2.3, 3.2, 4.3, 5.2, 5.3_

- [ ] 10. Checkpoint — Ensure all component tests pass, ask the user if questions arise.

- [x] 11. Create the Next.js page and wire everything together
  - Create `src/app/subscribe/[creatorId]/confirm/page.tsx` as a server component
  - Read `creatorId` from route params and `planId` from search params
  - Render `<SubscribeConfirmationFlow creatorId={creatorId} planId={planId} />`
  - _Requirements: 1.1, 2.1, 3.3, 3.4_

- [ ] 12. Final checkpoint — Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Install fast-check before running property tests: `npm install --save-dev fast-check`
- Each property test maps 1-to-1 to a correctness property in the design document
- `TxFailureRecovery` (existing) handles all error display; no new error components needed
- All error codes reuse the existing `AppError` / `ErrorCode` system in `src/types/errors.ts`
