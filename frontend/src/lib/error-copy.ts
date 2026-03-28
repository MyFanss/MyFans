/**
 * ## User-facing error copy (MyFans)
 *
 * - **Title (`message`)**: Short, plain language. Prefer “Couldn’t …” over “Error: …”. No internal codes in the title.
 * - **Body (`description`)**: Brief cause + **at least one** concrete next step the user can take.
 * - **Single source**: Prefer `ErrorCode` defaults in `@/types/errors` (`createAppError`). Use this module for
 *   flow-specific wording or to append a short technical hint from a caught error.
 * - **Tone**: Second person (“you”), active voice, no blame.
 *
 * When adding new surfaces, add or reuse an `ErrorCode` before inventing ad hoc strings in components.
 */

import type { ToastOptions } from '@/contexts/ToastContext';
import { createAppError, type ErrorCode } from '@/types/errors';

const DETAIL_MAX = 120;

function truncateDetail(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > DETAIL_MAX ? `${t.slice(0, DETAIL_MAX - 1)}…` : t;
}

/** Merge standard copy for `code` with a short hint from `cause` (e.g. `Error.message`). */
export function errorToastWithCause(
  code: ErrorCode,
  cause: unknown,
): Pick<ToastOptions, 'message' | 'description'> {
  const base = createAppError(code);
  const raw =
    cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : '';
  const detail = raw ? truncateDetail(raw) : '';
  const description = detail ? `${base.description ?? ''} (${detail})` : base.description;
  return {
    message: base.message,
    description,
  };
}

export function subscribeToCreatorFailed(
  creatorName: string,
): Pick<ToastOptions, 'message' | 'description'> {
  return {
    message: `Couldn’t subscribe to ${creatorName}`,
    description:
      'Open your wallet, approve the transaction when prompted, then tap Subscribe again. Refresh if your wallet doesn’t pop up.',
  };
}

export const subscriptionActionToast = {
  cancelFailed: (): Pick<ToastOptions, 'message' | 'description'> => ({
    message: 'Couldn’t cancel subscription',
    description:
      'Confirm in your wallet if prompted, then try Cancel again. If nothing happens, refresh and reconnect your wallet.',
  }),
  renewFailed: (): Pick<ToastOptions, 'message' | 'description'> => ({
    message: 'Couldn’t renew subscription',
    description:
      'Approve the renewal in your wallet, then tap Renew again. If your balance is low, add funds in Settings first.',
  }),
};

export function subscriptionsLoadFailed(): Pick<ToastOptions, 'message' | 'description'> {
  return {
    message: 'Couldn’t load subscriptions',
    description:
      'Refresh the page. If it still fails, check your internet and that the app backend is running.',
  };
}
