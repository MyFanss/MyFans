/**
 * NotificationPreferencesForm
 *
 * Preferences form rendered inside /settings (Notifications section).
 * Fetches live preferences from /api/v1/notification-preferences and
 * persists changes via PATCH (CSRF token attached by apiFetch).
 *
 * e2e contract (notification-preferences.spec.ts):
 *   - data-testid="notification-preferences-form"
 *   - role="switch" with accessible names matching the spec
 *   - "Save preferences" button
 *   - "Preferences saved" success text after save
 *
 * Refs: #1830, frontend/e2e/notification-preferences.spec.ts
 */
'use client';

import { useEffect, useReducer } from 'react';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/notifications-api';

// ── State ─────────────────────────────────────────────────────────────────

interface PrefsState {
  prefs: NotificationPreferences | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  success: boolean;
}

type PrefsAction =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_DONE'; prefs: NotificationPreferences }
  | { type: 'LOAD_ERROR'; error: string }
  | { type: 'TOGGLE_MASTER'; channel: 'emailEnabled' | 'pushEnabled' | 'marketingEmailsEnabled' }
  | { type: 'TOGGLE_EVENT'; key: keyof NotificationPreferences['events'] }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_DONE'; prefs: NotificationPreferences }
  | { type: 'SAVE_ERROR'; error: string };

function reducer(state: PrefsState, action: PrefsAction): PrefsState {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, error: null };
    case 'LOAD_DONE':
      return { ...state, loading: false, prefs: action.prefs };
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'TOGGLE_MASTER':
      if (!state.prefs) return state;
      return {
        ...state,
        prefs: { ...state.prefs, [action.channel]: !state.prefs[action.channel] },
      };
    case 'TOGGLE_EVENT':
      if (!state.prefs) return state;
      return {
        ...state,
        prefs: {
          ...state.prefs,
          events: {
            ...state.prefs.events,
            [action.key]: !state.prefs.events[action.key],
          },
        },
      };
    case 'SAVE_START':
      return { ...state, saving: true, error: null, success: false };
    case 'SAVE_DONE':
      return { ...state, saving: false, prefs: action.prefs, success: true, error: null };
    case 'SAVE_ERROR':
      return { ...state, saving: false, error: action.error, success: false };
    default:
      return state;
  }
}

// ── Toggle component ──────────────────────────────────────────────────────

interface SwitchProps {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

function Switch({ label, checked, disabled = false, onToggle }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`prefs-switch${checked ? ' prefs-switch--on' : ''}${disabled ? ' prefs-switch--disabled' : ''}`}
      onClick={onToggle}
    >
      <span className="prefs-switch__track" />
    </button>
  );
}

// ── Form ──────────────────────────────────────────────────────────────────

export function NotificationPreferencesForm() {
  const [state, dispatch] = useReducer(reducer, {
    prefs: null,
    loading: true,
    saving: false,
    error: null,
    success: false,
  });

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: 'LOAD_START' });
    fetchNotificationPreferences()
      .then((prefs) => {
        if (!cancelled) dispatch({ type: 'LOAD_DONE', prefs });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          dispatch({
            type: 'LOAD_ERROR',
            error: err instanceof Error ? err.message : 'Failed to load preferences.',
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    if (!state.prefs) return;
    dispatch({ type: 'SAVE_START' });
    try {
      const updated = await updateNotificationPreferences(state.prefs);
      dispatch({ type: 'SAVE_DONE', prefs: updated });
    } catch (err) {
      dispatch({
        type: 'SAVE_ERROR',
        error: err instanceof Error ? err.message : 'Failed to save preferences.',
      });
    }
  }

  if (state.loading) {
    return <p role="status">Loading preferences…</p>;
  }

  if (!state.prefs) {
    return (
      <p role="alert" className="prefs-form__error">
        {state.error ?? 'Could not load preferences.'}
      </p>
    );
  }

  const { prefs } = state;

  return (
    <div
      data-testid="notification-preferences-form"
      className="prefs-form"
      aria-label="Notification preferences"
    >
      {/* ── Master channel switches ────────────────────────────── */}
      <section className="prefs-form__section">
        <h3 className="prefs-form__section-title">Channels</h3>

        <div className="prefs-form__row">
          <label htmlFor="email-master">Email notifications</label>
          <Switch
            label="Email notifications"
            checked={prefs.emailEnabled}
            onToggle={() => dispatch({ type: 'TOGGLE_MASTER', channel: 'emailEnabled' })}
          />
        </div>

        <div className="prefs-form__row">
          <label htmlFor="push-master">Push notifications</label>
          <Switch
            label="Push notifications"
            checked={prefs.pushEnabled}
            onToggle={() => dispatch({ type: 'TOGGLE_MASTER', channel: 'pushEnabled' })}
          />
        </div>

        <div className="prefs-form__row">
          <label htmlFor="marketing-master">Marketing emails</label>
          <Switch
            label="Marketing emails"
            checked={prefs.marketingEmailsEnabled}
            onToggle={() =>
              dispatch({ type: 'TOGGLE_MASTER', channel: 'marketingEmailsEnabled' })
            }
          />
        </div>
      </section>

      {/* ── Per-event email toggles ─────────────────────────────── */}
      <section className="prefs-form__section">
        <h3 className="prefs-form__section-title">Email events</h3>

        <div className="prefs-form__row">
          <label>New subscriber via email</label>
          <Switch
            label="New subscriber via email"
            checked={prefs.events['new_subscriber_email'] ?? true}
            disabled={!prefs.emailEnabled}
            onToggle={() =>
              dispatch({ type: 'TOGGLE_EVENT', key: 'new_subscriber_email' })
            }
          />
        </div>

        <div className="prefs-form__row">
          <label>Payout sent via email</label>
          <Switch
            label="Payout sent via email"
            checked={prefs.events['payout_sent_email'] ?? true}
            disabled={!prefs.emailEnabled}
            onToggle={() =>
              dispatch({ type: 'TOGGLE_EVENT', key: 'payout_sent_email' })
            }
          />
        </div>

        <div className="prefs-form__row">
          <label>Subscription renewed via email</label>
          <Switch
            label="Subscription renewed via email"
            checked={prefs.events['subscription_renewed_email'] ?? true}
            disabled={!prefs.emailEnabled}
            onToggle={() =>
              dispatch({ type: 'TOGGLE_EVENT', key: 'subscription_renewed_email' })
            }
          />
        </div>
      </section>

      {/* ── Per-event push toggles ──────────────────────────────── */}
      <section className="prefs-form__section">
        <h3 className="prefs-form__section-title">Push events</h3>

        <div className="prefs-form__row">
          <label>New subscriber via push</label>
          <Switch
            label="New subscriber via push"
            checked={prefs.events['new_subscriber_push'] ?? true}
            disabled={!prefs.pushEnabled}
            onToggle={() =>
              dispatch({ type: 'TOGGLE_EVENT', key: 'new_subscriber_push' })
            }
          />
        </div>

        <div className="prefs-form__row">
          <label>New message via push</label>
          <Switch
            label="New message via push"
            checked={prefs.events['new_message_push'] ?? true}
            disabled={!prefs.pushEnabled}
            onToggle={() =>
              dispatch({ type: 'TOGGLE_EVENT', key: 'new_message_push' })
            }
          />
        </div>
      </section>

      {/* ── Feedback & save ─────────────────────────────────────── */}
      {state.error && (
        <p className="prefs-form__error" role="alert">
          {state.error}
        </p>
      )}

      {state.success && (
        <p className="prefs-form__success" role="status">
          Preferences saved
        </p>
      )}

      <button
        type="button"
        className="prefs-form__save"
        onClick={() => void handleSave()}
        disabled={state.saving}
        aria-busy={state.saving}
      >
        {state.saving ? 'Saving…' : 'Save preferences'}
      </button>
    </div>
  );
}
