/**
 * Transaction failure detection and guided recovery copy.
 *
 * Covers the full spectrum of on-chain failure modes users encounter
 * on Stellar/Soroban: network congestion, rejected signatures, insufficient
 * funds, timeouts, and generic failures.
 */

import type { AppError, ErrorCode } from '@/types/errors';

// ── Failure types ──────────────────────────────────────────────────────────

export type TxFailureType =
  | 'rejected_signature'   // user declined in wallet
  | 'network_congestion'   // high load / fee surge
  | 'insufficient_funds'   // not enough XLM / token
  | 'timeout'              // tx not confirmed in time
  | 'rpc_error'            // node/RPC unreachable
  | 'offline'              // no internet
  | 'build_failed'         // tx construction error
  | 'generic';             // catch-all

// ── Recovery action ────────────────────────────────────────────────────────

export interface RecoveryAction {
  label: string;
  /** retry = re-execute the tx, back = go to previous step,
   *  external = open URL in new tab, dismiss = clear error */
  kind: 'retry' | 'back' | 'external' | 'dismiss';
  href?: string;
  primary: boolean;
}

// ── Recovery guidance ──────────────────────────────────────────────────────

export interface TxRecoveryGuide {
  type: TxFailureType;
  /** Short headline shown prominently */
  headline: string;
  /** One-sentence explanation in plain language */
  explanation: string;
  /** Bullet-point steps the user should take */
  steps: string[];
  /** Suggested actions (buttons) */
  actions: RecoveryAction[];
  /** Whether the user can meaningfully retry right now */
  canRetry: boolean;
}

// ── Error-code → failure-type map ─────────────────────────────────────────

const CODE_TO_TYPE: Partial<Record<ErrorCode, TxFailureType>> = {
  TX_REJECTED: 'rejected_signature',
  WALLET_SIGNATURE_FAILED: 'rejected_signature',
  NETWORK_FEE_ERROR: 'network_congestion',
  TX_TIMEOUT: 'timeout',
  NETWORK_TIMEOUT: 'timeout',
  INSUFFICIENT_BALANCE: 'insufficient_funds',
  INSUFFICIENT_FUNDS: 'insufficient_funds',
  RPC_ERROR: 'rpc_error',
  NETWORK_ERROR: 'rpc_error',
  CONNECTION_LOST: 'offline',
  OFFLINE: 'offline',
  TX_BUILD_FAILED: 'build_failed',
  TX_SUBMIT_FAILED: 'generic',
  TX_FAILED: 'generic',
};

/**
 * Detect the failure type from an AppError.
 * Falls back to message-string heuristics when the code alone isn't enough.
 */
export function detectFailureType(error: AppError): TxFailureType {
  const fromCode = CODE_TO_TYPE[error.code];
  if (fromCode) return fromCode;

  // Heuristic fallback on message text
  const msg = (error.message + ' ' + (error.description ?? '')).toLowerCase();

  if (msg.includes('reject') || msg.includes('denied') || msg.includes('cancel')) {
    return 'rejected_signature';
  }
  if (msg.includes('congestion') || msg.includes('fee') || msg.includes('surge')) {
    return 'network_congestion';
  }
  if (msg.includes('insufficient') || msg.includes('balance') || msg.includes('funds')) {
    return 'insufficient_funds';
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return 'timeout';
  }
  if (msg.includes('offline') || msg.includes('no internet')) {
    return 'offline';
  }
  if (msg.includes('rpc') || msg.includes('node') || msg.includes('network')) {
    return 'rpc_error';
  }

  return 'generic';
}

// ── Recovery guides ────────────────────────────────────────────────────────

const GUIDES: Record<TxFailureType, TxRecoveryGuide> = {
  rejected_signature: {
    type: 'rejected_signature',
    headline: 'Transaction rejected in wallet',
    explanation:
      'You declined the signature request in your Freighter wallet. No funds were moved.',
    steps: [
      'Open your Freighter wallet and make sure it is unlocked.',
      'Click "Sign & Subscribe" again when you are ready.',
      'In the Freighter popup, review the details and click "Approve".',
    ],
    actions: [
      { label: 'Try again', kind: 'retry', primary: true },
      { label: 'Go back', kind: 'back', primary: false },
    ],
    canRetry: true,
  },

  network_congestion: {
    type: 'network_congestion',
    headline: 'Network is congested',
    explanation:
      'The Stellar network is experiencing high traffic. Fees may be elevated and transactions are taking longer than usual.',
    steps: [
      'Wait 30–60 seconds for congestion to ease, then retry.',
      'If the problem persists, check the Stellar network status page.',
      'Your funds have not been deducted — it is safe to retry.',
    ],
    actions: [
      { label: 'Retry transaction', kind: 'retry', primary: true },
      {
        label: 'Check network status',
        kind: 'external',
        href: 'https://dashboard.stellar.org',
        primary: false,
      },
      { label: 'Go back', kind: 'back', primary: false },
    ],
    canRetry: true,
  },

  insufficient_funds: {
    type: 'insufficient_funds',
    headline: 'Insufficient balance',
    explanation:
      'Your wallet does not have enough funds to cover this transaction and the network fee.',
    steps: [
      'Check your wallet balance in Freighter.',
      'Add more XLM or the required token to your wallet.',
      'Remember to keep a small XLM reserve for network fees (minimum 1 XLM recommended).',
      'Return here once your balance is topped up.',
    ],
    actions: [
      { label: 'Go back', kind: 'back', primary: true },
      {
        label: 'How to fund my wallet',
        kind: 'external',
        href: 'https://freighter.app',
        primary: false,
      },
    ],
    canRetry: false,
  },

  timeout: {
    type: 'timeout',
    headline: 'Transaction timed out',
    explanation:
      'The transaction was submitted but did not receive confirmation within the expected window. It may still be processing.',
    steps: [
      'Check your Freighter wallet history to see if the transaction went through.',
      'Wait a few minutes before retrying — submitting again too quickly can cause duplicate charges.',
      'If the transaction appears in your history, you are already subscribed.',
    ],
    actions: [
      {
        label: 'Check wallet history',
        kind: 'external',
        href: 'https://stellar.expert',
        primary: true,
      },
      { label: 'Retry anyway', kind: 'retry', primary: false },
      { label: 'Go back', kind: 'back', primary: false },
    ],
    canRetry: true,
  },

  rpc_error: {
    type: 'rpc_error',
    headline: 'Could not reach the network',
    explanation:
      'There was a problem communicating with the Stellar network. This is usually temporary.',
    steps: [
      'Check your internet connection.',
      'Wait a moment and try again — the issue is likely on the network side.',
      'If the problem continues, the Stellar network may be experiencing an outage.',
    ],
    actions: [
      { label: 'Retry', kind: 'retry', primary: true },
      {
        label: 'Stellar status',
        kind: 'external',
        href: 'https://dashboard.stellar.org',
        primary: false,
      },
      { label: 'Go back', kind: 'back', primary: false },
    ],
    canRetry: true,
  },

  offline: {
    type: 'offline',
    headline: 'You appear to be offline',
    explanation:
      'No internet connection was detected. Please reconnect and try again.',
    steps: [
      'Check your Wi-Fi or mobile data connection.',
      'Once you are back online, click "Retry".',
      'Your transaction has not been submitted — no funds were moved.',
    ],
    actions: [
      { label: 'Retry when online', kind: 'retry', primary: true },
      { label: 'Go back', kind: 'back', primary: false },
    ],
    canRetry: true,
  },

  build_failed: {
    type: 'build_failed',
    headline: 'Could not build the transaction',
    explanation:
      'There was a problem constructing the transaction. This is usually a temporary issue.',
    steps: [
      'Go back and try again.',
      'Make sure your wallet is connected and unlocked.',
      'If the issue persists, try refreshing the page.',
    ],
    actions: [
      { label: 'Try again', kind: 'retry', primary: true },
      { label: 'Go back', kind: 'back', primary: false },
    ],
    canRetry: true,
  },

  generic: {
    type: 'generic',
    headline: 'Transaction failed',
    explanation:
      'Something went wrong while processing your transaction. No funds were deducted.',
    steps: [
      'Wait a moment and try again.',
      'Make sure your wallet is connected and unlocked.',
      'If the problem keeps happening, contact support.',
    ],
    actions: [
      { label: 'Try again', kind: 'retry', primary: true },
      { label: 'Go back', kind: 'back', primary: false },
    ],
    canRetry: true,
  },
};

/**
 * Get the full recovery guide for a given AppError.
 */
export function getRecoveryGuide(error: AppError): TxRecoveryGuide {
  const type = detectFailureType(error);
  return GUIDES[type];
}

/**
 * Get just the failure type for a given AppError.
 */
export { GUIDES as RECOVERY_GUIDES };
