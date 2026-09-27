/**
 * Settings page — /settings
 *
 * Unified settings page covering:
 *   • Profile (display name, avatar)
 *   • Payout wallet — single source of truth, used by both dashboard and settings
 *   • Spending cap — live, wired to /api/v1/spending-cap
 *   • Notification preferences (renders NotificationPreferencesForm)
 *   • Delete account — requires typing "delete my account" to confirm
 *
 * All mutating calls carry a CSRF token via apiFetch (see frontend/docs/CSRF.md).
 * The middleware guards this route; unauthenticated users are redirected by
 * Next.js Edge middleware before this page renders.
 *
 * Refs: #1827, #1830, frontend/docs/CSRF.md, frontend/docs/ADR-001-role-model.md
 */
'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import {
  fetchSettings,
  updateSettings,
  fetchSpendingCap,
  updateSpendingCap,
  deleteAccount,
  type UserSettings,
  type SpendingCap,
} from '@/lib/settings-api';
import { clearAuthToken } from '@/lib/auth-storage';
import { useUser } from '@/context/UserContext';
import { useRouter } from 'next/navigation';
import { NotificationPreferencesForm } from '@/components/NotificationPreferencesForm';

// ── Section tabs ──────────────────────────────────────────────────────────

type Section = 'profile' | 'payout' | 'spending' | 'notifications' | 'danger';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'payout', label: 'Payout wallet' },
  { id: 'spending', label: 'Spending cap' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'danger', label: 'Danger zone' },
];

// ── State ─────────────────────────────────────────────────────────────────

interface SettingsState {
  section: Section;
  settings: UserSettings | null;
  cap: SpendingCap | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  success: string | null;
}

type SettingsAction =
  | { type: 'SET_SECTION'; section: Section }
  | { type: 'LOAD_START' }
  | { type: 'LOAD_DONE'; settings: UserSettings; cap: SpendingCap }
  | { type: 'LOAD_ERROR'; error: string }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_DONE'; settings?: UserSettings; cap?: SpendingCap; success: string }
  | { type: 'SAVE_ERROR'; error: string }
  | { type: 'CLEAR_FEEDBACK' };

function reducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case 'SET_SECTION':
      return { ...state, section: action.section, error: null, success: null };
    case 'LOAD_START':
      return { ...state, loading: true, error: null };
    case 'LOAD_DONE':
      return { ...state, loading: false, settings: action.settings, cap: action.cap };
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'SAVE_START':
      return { ...state, saving: true, error: null, success: null };
    case 'SAVE_DONE':
      return {
        ...state,
        saving: false,
        settings: action.settings ?? state.settings,
        cap: action.cap ?? state.cap,
        success: action.success,
        error: null,
      };
    case 'SAVE_ERROR':
      return { ...state, saving: false, error: action.error, success: null };
    case 'CLEAR_FEEDBACK':
      return { ...state, error: null, success: null };
    default:
      return state;
  }
}

const INITIAL: SettingsState = {
  section: 'profile',
  settings: null,
  cap: null,
  loading: true,
  saving: false,
  error: null,
  success: null,
};

// ── Delete confirm dialog ─────────────────────────────────────────────────

const DELETE_PHRASE = 'delete my account';

interface DeleteDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
  deleting: boolean;
}

function DeleteConfirmDialog({ onCancel, onConfirm, deleting }: DeleteDialogProps) {
  const [phrase, setPhrase] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      className="delete-dialog"
    >
      <h2 id="delete-dialog-title" className="delete-dialog__title">
        Delete your account?
      </h2>
      <p className="delete-dialog__body">
        This action is <strong>permanent and irreversible</strong>. All your data,
        subscriptions, and content will be deleted.
      </p>
      <p className="delete-dialog__instruction">
        Type <strong>{DELETE_PHRASE}</strong> to confirm:
      </p>
      <input
        ref={inputRef}
        type="text"
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        placeholder={DELETE_PHRASE}
        aria-label="Type the confirmation phrase"
        className="delete-dialog__input"
        autoComplete="off"
      />
      <div className="delete-dialog__actions">
        <button
          type="button"
          className="delete-dialog__cancel"
          onClick={onCancel}
          disabled={deleting}
        >
          Cancel
        </button>
        <button
          type="button"
          className="delete-dialog__confirm"
          disabled={phrase !== DELETE_PHRASE || deleting}
          aria-busy={deleting}
          onClick={onConfirm}
        >
          {deleting ? 'Deleting…' : 'Delete my account'}
        </button>
      </div>
    </div>
  );
}

// ── Settings page ─────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, refreshUser } = useUser();
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load settings and cap in parallel.
  useEffect(() => {
    let cancelled = false;
    dispatch({ type: 'LOAD_START' });
    Promise.all([fetchSettings(), fetchSpendingCap()])
      .then(([settings, cap]) => {
        if (!cancelled) dispatch({ type: 'LOAD_DONE', settings, cap });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          dispatch({
            type: 'LOAD_ERROR',
            error: err instanceof Error ? err.message : 'Failed to load settings.',
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Profile save ───────────────────────────────────────────────────────
  async function handleProfileSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    dispatch({ type: 'SAVE_START' });
    try {
      const updated = await updateSettings({
        displayName: (data.get('displayName') as string) || null,
        avatarUrl: (data.get('avatarUrl') as string) || null,
      });
      await refreshUser();
      dispatch({ type: 'SAVE_DONE', settings: updated, success: 'Profile updated.' });
    } catch (err) {
      dispatch({
        type: 'SAVE_ERROR',
        error: err instanceof Error ? err.message : 'Failed to save profile.',
      });
    }
  }

  // ── Payout wallet save ─────────────────────────────────────────────────
  async function handlePayoutSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    dispatch({ type: 'SAVE_START' });
    try {
      const updated = await updateSettings({
        payoutWallet: (data.get('payoutWallet') as string) || null,
      });
      dispatch({ type: 'SAVE_DONE', settings: updated, success: 'Payout wallet updated.' });
    } catch (err) {
      dispatch({
        type: 'SAVE_ERROR',
        error: err instanceof Error ? err.message : 'Failed to save payout wallet.',
      });
    }
  }

  // ── Spending cap save ──────────────────────────────────────────────────
  async function handleCapSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const rawAmount = data.get('amountLimit') as string;
    dispatch({ type: 'SAVE_START' });
    try {
      const updated = await updateSpendingCap({
        amountLimit: rawAmount === '' || rawAmount === null ? null : Number(rawAmount),
        asset: (data.get('asset') as string) || 'XLM',
        periodDays: Number(data.get('periodDays') ?? 30),
      });
      dispatch({ type: 'SAVE_DONE', cap: updated, success: 'Spending cap updated.' });
    } catch (err) {
      dispatch({
        type: 'SAVE_ERROR',
        error: err instanceof Error ? err.message : 'Failed to save spending cap.',
      });
    }
  }

  // ── Delete account ─────────────────────────────────────────────────────
  async function handleDeleteConfirm() {
    setDeleting(true);
    try {
      await deleteAccount(DELETE_PHRASE);
      clearAuthToken();
      router.replace('/');
    } catch (err) {
      dispatch({
        type: 'SAVE_ERROR',
        error: err instanceof Error ? err.message : 'Failed to delete account.',
      });
      setShowDeleteDialog(false);
    } finally {
      setDeleting(false);
    }
  }

  if (state.loading) {
    return (
      <main className="settings-page">
        <p role="status">Loading settings…</p>
      </main>
    );
  }

  return (
    <main className="settings-page" aria-label="Settings">
      <h1 className="settings-page__title">Settings</h1>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="settings-page__breadcrumb">
        <ol>
          <li><a href="/">Home</a></li>
          <li aria-current="page">Settings</li>
        </ol>
      </nav>

      {/* Section tabs */}
      <div role="tablist" aria-label="Settings sections" className="settings-page__tabs">
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={state.section === id}
            type="button"
            className={`settings-page__tab${state.section === id ? ' settings-page__tab--active' : ''}`}
            onClick={() => dispatch({ type: 'SET_SECTION', section: id })}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {state.error && (
        <p className="settings-page__error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="settings-page__success" role="status">
          {state.success}
        </p>
      )}

      {/* ── Profile ─────────────────────────────────────────────── */}
      {state.section === 'profile' && state.settings && (
        <section aria-labelledby="profile-heading" className="settings-page__section">
          <h2 id="profile-heading">Profile</h2>
          <form onSubmit={(e) => void handleProfileSave(e)} aria-label="Profile form">
            <label htmlFor="displayName">Display name</label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              defaultValue={state.settings.displayName ?? ''}
            />
            <label htmlFor="avatarUrl">Avatar URL</label>
            <input
              id="avatarUrl"
              name="avatarUrl"
              type="url"
              defaultValue={state.settings.avatarUrl ?? ''}
            />
            <button type="submit" disabled={state.saving} aria-busy={state.saving}>
              {state.saving ? 'Saving…' : 'Save profile'}
            </button>
          </form>
        </section>
      )}

      {/* ── Payout wallet ───────────────────────────────────────── */}
      {state.section === 'payout' && state.settings && (
        <section aria-labelledby="payout-heading" className="settings-page__section">
          <h2 id="payout-heading">Payout wallet</h2>
          <p className="settings-page__hint">
            Earnings are sent to this Stellar address. This is the single payout
            wallet used across your dashboard and settings.
          </p>
          <form onSubmit={(e) => void handlePayoutSave(e)} aria-label="Payout wallet form">
            <label htmlFor="payoutWallet">Stellar address (G…)</label>
            <input
              id="payoutWallet"
              name="payoutWallet"
              type="text"
              defaultValue={state.settings.payoutWallet ?? ''}
              placeholder="GABC…"
              pattern="G[A-Z2-7]{55}"
              title="Must be a valid Stellar public key"
            />
            <button type="submit" disabled={state.saving} aria-busy={state.saving}>
              {state.saving ? 'Saving…' : 'Save payout wallet'}
            </button>
          </form>
        </section>
      )}

      {/* ── Spending cap ────────────────────────────────────────── */}
      {state.section === 'spending' && state.cap && (
        <section aria-labelledby="cap-heading" className="settings-page__section">
          <h2 id="cap-heading">Spending cap</h2>
          <p className="settings-page__hint">
            Limit how much you can spend per period. Leave blank to remove the cap.
          </p>
          <form onSubmit={(e) => void handleCapSave(e)} aria-label="Spending cap form">
            <label htmlFor="amountLimit">Amount limit</label>
            <input
              id="amountLimit"
              name="amountLimit"
              type="number"
              min="0"
              step="0.01"
              defaultValue={state.cap.amountLimit ?? ''}
              placeholder="Unlimited"
            />
            <label htmlFor="asset">Asset</label>
            <select id="asset" name="asset" defaultValue={state.cap.asset}>
              <option value="XLM">XLM</option>
              <option value="USDC">USDC</option>
            </select>
            <label htmlFor="periodDays">Period (days)</label>
            <input
              id="periodDays"
              name="periodDays"
              type="number"
              min="1"
              defaultValue={state.cap.periodDays}
            />
            <button type="submit" disabled={state.saving} aria-busy={state.saving}>
              {state.saving ? 'Saving…' : 'Save spending cap'}
            </button>
          </form>
        </section>
      )}

      {/* ── Notifications ───────────────────────────────────────── */}
      {state.section === 'notifications' && (
        <section aria-labelledby="notif-heading" className="settings-page__section">
          <h2 id="notif-heading">Notification preferences</h2>
          <NotificationPreferencesForm />
        </section>
      )}

      {/* ── Danger zone ─────────────────────────────────────────── */}
      {state.section === 'danger' && (
        <section aria-labelledby="danger-heading" className="settings-page__section settings-page__section--danger">
          <h2 id="danger-heading">Danger zone</h2>
          <p>
            Deleting your account is permanent and cannot be undone. All subscriptions,
            content, and earnings data will be lost.
          </p>
          <button
            type="button"
            className="settings-page__delete-btn"
            onClick={() => setShowDeleteDialog(true)}
          >
            Delete my account
          </button>
        </section>
      )}

      {/* ── Delete confirm dialog ──────────────────────────────── */}
      {showDeleteDialog && (
        <div className="settings-page__overlay" role="presentation">
          <DeleteConfirmDialog
            onCancel={() => setShowDeleteDialog(false)}
            onConfirm={() => void handleDeleteConfirm()}
            deleting={deleting}
          />
        </div>
      )}
    </main>
  );
}
