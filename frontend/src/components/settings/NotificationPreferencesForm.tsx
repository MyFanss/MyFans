'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchNotificationPreferences,
  saveNotificationPreferences,
  EVENT_TYPES,
  DEFAULT_PREFERENCES,
  type NotificationPreferences,
  type PreferenceKey,
} from '@/lib/notification-preferences';

// ── Toggle ─────────────────────────────────────────────────────────────────

interface ToggleProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}

function Toggle({ id, checked, onChange, disabled = false, label }: ToggleProps) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-800 disabled:cursor-not-allowed disabled:opacity-40 ${
        checked
          ? 'bg-slate-900 dark:bg-slate-100'
          : 'bg-slate-200 dark:bg-slate-600'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white dark:bg-slate-900 shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
        aria-hidden="true"
      />
    </button>
  );
}

// ── Section header ─────────────────────────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

const USE_MOCK = true; // flip to false when backend is live

export function NotificationPreferencesForm() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Load preferences
  useEffect(() => {
    if (USE_MOCK) {
      setLoading(false);
      return;
    }
    fetchNotificationPreferences()
      .then(setPrefs)
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const set = useCallback((key: PreferenceKey, value: boolean) => {
    setSaveStatus('idle');
    setPrefs((prev: NotificationPreferences) => ({ ...prev, [key]: value }));
  }, []);

  // When a channel master switch is turned off, disable all its per-event toggles
  const setChannel = useCallback(
    (channel: 'email' | 'push', value: boolean) => {
      const masterKey: PreferenceKey =
        channel === 'email' ? 'email_notifications' : 'push_notifications';
      setSaveStatus('idle');
      setPrefs((prev: NotificationPreferences) => {
        const next = { ...prev, [masterKey]: value };
        if (!value) {
          for (const ev of EVENT_TYPES) {
            (next as Record<string, boolean>)[`${channel}_${ev.key}`] = false;
          }
        }
        return next;
      });
    },
    [],
  );

  const handleSave = async () => {
    if (USE_MOCK) {
      setSaving(true);
      await new Promise((r) => setTimeout(r, 600));
      setSaving(false);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
      return;
    }
    setSaving(true);
    setSaveStatus('idle');
    try {
      await saveNotificationPreferences(prefs);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10" aria-live="polite" aria-busy="true">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" aria-label="Loading preferences" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-600 dark:text-red-400"
        role="alert"
      >
        Failed to load preferences: {loadError}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e: { preventDefault: () => void }) => { e.preventDefault(); handleSave(); }}
      aria-label="Notification preferences"
      data-testid="notification-preferences-form"
    >
      {/* ── Channel master switches ── */}
      <fieldset className="mb-6">
        <legend className="sr-only">Notification channels</legend>
        <SectionHeader
          title="Channels"
          description="Master switches for each delivery channel."
        />
        <div className="space-y-2">
          {(
            [
              {
                key: 'email_notifications' as PreferenceKey,
                label: 'Email notifications',
                desc: 'Receive notifications by email',
                channel: 'email' as const,
              },
              {
                key: 'push_notifications' as PreferenceKey,
                label: 'Push notifications',
                desc: 'Receive browser or mobile push alerts',
                channel: 'push' as const,
              },
              {
                key: 'marketing_emails' as PreferenceKey,
                label: 'Marketing emails',
                desc: 'Product updates, tips, and announcements',
                channel: null,
              },
            ] as const
          ).map(({ key, label, desc, channel }) => (
            <div
              key={key}
              className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
              </div>
              <Toggle
                id={key}
                checked={prefs[key]}
                onChange={(v) =>
                  channel ? setChannel(channel, v) : set(key, v)
                }
                label={label}
              />
            </div>
          ))}
        </div>
      </fieldset>

      {/* ── Per-event toggles ── */}
      {(['email', 'push'] as const).map((channel) => {
        const masterKey: PreferenceKey =
          channel === 'email' ? 'email_notifications' : 'push_notifications';
        const channelEnabled = prefs[masterKey];
        const channelLabel = channel === 'email' ? 'Email' : 'Push';

        return (
          <fieldset key={channel} className="mb-6">
            <legend className="sr-only">{channelLabel} per-event preferences</legend>
            <SectionHeader
              title={`${channelLabel} — per event`}
              description={
                channelEnabled
                  ? `Choose which events trigger a ${channel} notification.`
                  : `Enable ${channel} notifications above to configure per-event settings.`
              }
            />
            <div className="space-y-2">
              {EVENT_TYPES.map((ev) => {
                const key = `${channel}_${ev.key}` as PreferenceKey;
                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between gap-4 rounded-xl border px-3 py-3 transition-opacity ${
                      channelEnabled
                        ? 'border-slate-200 dark:border-slate-700'
                        : 'border-slate-100 dark:border-slate-800 opacity-50'
                    }`}
                  >
                    <div>
                      <p className="text-sm text-slate-800 dark:text-slate-200">{ev.label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{ev.description}</p>
                    </div>
                    <Toggle
                      id={key}
                      checked={prefs[key]}
                      onChange={(v) => set(key, v)}
                      disabled={!channelEnabled}
                      label={`${ev.label} via ${channel}`}
                    />
                  </div>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {/* ── Save bar ── */}
      <div className="flex items-center justify-between gap-3 pt-2">
        {saveStatus === 'success' && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status" aria-live="polite">
            Preferences saved.
          </p>
        )}
        {saveStatus === 'error' && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            Failed to save. Please try again.
          </p>
        )}
        {saveStatus === 'idle' && <span />}

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-slate-900 dark:bg-white px-5 py-2.5 text-sm font-semibold text-white dark:text-slate-900 transition hover:bg-slate-700 dark:hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
          aria-busy={saving}
        >
          {saving ? 'Saving…' : 'Save preferences'}
        </button>
      </div>
    </form>
  );
}
