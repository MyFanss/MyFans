# Requirements Document

## Introduction

The Subscribe Confirmation UI is a frontend feature that guides a fan through the final steps of subscribing to a creator on the MyFans platform. The flow covers: displaying a confirmation screen with plan details, triggering a Stellar/Soroban wallet signing request via Freighter, polling for on-chain transaction confirmation, and gracefully handling all failure modes — including user-rejected signatures. On success, the fan is shown a confirmation and gains access to the creator's gated content.

## Glossary

- **Fan**: A user who subscribes to a creator's content plan.
- **Creator**: A user who publishes content and defines subscription plans.
- **Subscription_Plan**: A creator-defined plan with a price, currency (XLM or Stellar asset), and billing interval.
- **Confirmation_Screen**: The UI step that displays plan details before the fan commits to signing.
- **Wallet**: A Stellar wallet extension (e.g. Freighter) used to sign transactions.
- **Signing_Request**: The prompt sent to the Wallet asking the fan to approve a Soroban transaction.
- **Transaction**: A Soroban smart contract invocation that records the subscription on-chain.
- **Transaction_Hash**: The unique identifier returned by the Stellar network after a transaction is submitted.
- **Polling_Service**: The frontend service that periodically queries the Stellar network to confirm a transaction's status.
- **Subscribe_Flow**: The end-to-end sequence from viewing the Confirmation_Screen to receiving a success or failure outcome.
- **Subscribe_Confirmation_UI**: The system described in this document.

---

## Requirements

### Requirement 1: Display Subscription Confirmation Screen

**User Story:** As a Fan, I want to see a clear summary of the plan I am about to subscribe to, so that I can verify the details before committing.

#### Acceptance Criteria

1. WHEN a Fan navigates to the subscribe confirmation step for a Creator, THE Subscribe_Confirmation_UI SHALL display the Creator's name, the Subscription_Plan name, the price, the currency, and the billing interval.
2. THE Subscribe_Confirmation_UI SHALL display a primary "Sign & Subscribe" call-to-action button that initiates the Subscribe_Flow.
3. THE Subscribe_Confirmation_UI SHALL display a secondary "Cancel" option that returns the Fan to the previous screen without initiating a Signing_Request.
4. WHILE the Subscribe_Flow is in progress, THE Subscribe_Confirmation_UI SHALL disable the "Sign & Subscribe" button to prevent duplicate submissions.

---

### Requirement 2: Trigger Wallet Signing

**User Story:** As a Fan, I want my Wallet to prompt me to approve the subscription transaction, so that I can authorize the on-chain payment securely.

#### Acceptance Criteria

1. WHEN the Fan clicks "Sign & Subscribe", THE Subscribe_Confirmation_UI SHALL build a Soroban subscription Transaction using the Fan's connected wallet address, the Creator's address, and the Subscription_Plan identifier.
2. WHEN the Transaction is built, THE Subscribe_Confirmation_UI SHALL invoke the Wallet's signing interface and present the Signing_Request to the Fan.
3. WHILE the Signing_Request is pending, THE Subscribe_Confirmation_UI SHALL display a "Waiting for wallet approval" status indicator.
4. WHEN the Fan approves the Signing_Request, THE Subscribe_Confirmation_UI SHALL submit the signed Transaction to the Stellar network and transition to the polling state.

---

### Requirement 3: Poll and Confirm Transaction Completion

**User Story:** As a Fan, I want to see real-time feedback while my transaction is being confirmed on-chain, so that I know the subscription is being processed.

#### Acceptance Criteria

1. WHEN a signed Transaction has been submitted, THE Polling_Service SHALL query the Stellar network for the Transaction's status at intervals of no more than 3 seconds.
2. WHILE the Transaction is unconfirmed, THE Subscribe_Confirmation_UI SHALL display a progress indicator and the message "Confirming your subscription on-chain…".
3. WHEN the Polling_Service receives a confirmed status for the Transaction, THE Subscribe_Confirmation_UI SHALL display a success state showing the Creator's name and the message "You are now subscribed".
4. WHEN the Transaction is confirmed, THE Subscribe_Confirmation_UI SHALL provide a navigation action that takes the Fan to the Creator's gated content.
5. IF the Polling_Service does not receive a confirmed status within 60 seconds, THEN THE Subscribe_Confirmation_UI SHALL display a timeout error and present the Fan with options to check their wallet history or retry.

---

### Requirement 4: Handle User-Rejected Signatures

**User Story:** As a Fan, I want a clear explanation when I reject a signing request, so that I understand no funds were moved and I can try again if I choose.

#### Acceptance Criteria

1. IF the Fan rejects the Signing_Request in the Wallet, THEN THE Subscribe_Confirmation_UI SHALL detect the rejection and transition to an error state without submitting any Transaction.
2. WHEN a rejection error state is displayed, THE Subscribe_Confirmation_UI SHALL show the message "Transaction rejected in wallet" and confirm that no funds were deducted.
3. WHEN a rejection error state is displayed, THE Subscribe_Confirmation_UI SHALL present a "Try again" action that re-initiates the Signing_Request and a "Go back" action that returns the Fan to the Confirmation_Screen.
4. THE Subscribe_Confirmation_UI SHALL distinguish a user-rejected signature from other wallet errors and apply the rejection-specific messaging defined in Acceptance Criteria 2 and 3 of this requirement.

---

### Requirement 5: Handle Transaction Submission and Network Errors

**User Story:** As a Fan, I want actionable guidance when a network or submission error occurs, so that I can recover without losing my progress.

#### Acceptance Criteria

1. IF the Transaction submission fails due to a network error, THEN THE Subscribe_Confirmation_UI SHALL display the headline "Could not reach the network" and offer a "Retry" action.
2. IF the Transaction fails due to insufficient wallet balance, THEN THE Subscribe_Confirmation_UI SHALL display the headline "Insufficient balance", explain that the Fan needs more funds, and offer a "Go back" action.
3. IF the Transaction fails due to network congestion or elevated fees, THEN THE Subscribe_Confirmation_UI SHALL display the headline "Network is congested" and offer a "Retry transaction" action.
4. WHEN any error state is displayed, THE Subscribe_Confirmation_UI SHALL confirm that no funds were deducted unless the Transaction was already submitted.
5. THE Subscribe_Confirmation_UI SHALL support a maximum of 3 automatic retry attempts for network-class errors before presenting a permanent failure state.

---

### Requirement 6: Wallet Connection Gate

**User Story:** As a Fan, I want to be prompted to connect my wallet if it is not already connected, so that the Subscribe_Flow can proceed without confusion.

#### Acceptance Criteria

1. WHEN the Fan reaches the Confirmation_Screen without a connected Wallet, THE Subscribe_Confirmation_UI SHALL display a wallet connection prompt before showing the "Sign & Subscribe" button.
2. WHEN the Fan successfully connects a Wallet, THE Subscribe_Confirmation_UI SHALL display the Confirmation_Screen with the Fan's wallet address visible.
3. IF the Wallet extension is not installed, THEN THE Subscribe_Confirmation_UI SHALL display a message directing the Fan to install Freighter and provide a link to the Freighter installation page.
