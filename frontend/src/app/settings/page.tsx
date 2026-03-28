"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { SettingsShell } from "@/components/settings/settings-shell";
import { useSettings, type Role } from "@/components/settings/use-settings";
import { NotificationPreferencesForm } from "@/components/settings/NotificationPreferencesForm";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { useConsent } from "@/contexts/ConsentContext";
import { useToast } from "@/contexts/ToastContext";
import { ProfileSettingsPanel } from "@/components/settings/profile-settings-panel";

export default function SettingsPage() {
  const { showSuccess, showError, showInfo, showWarning } = useToast();
  const [role, setRole] = useState<Role>("creator");
  const [activeSectionId, setActiveSectionId] = useState("profile");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteComplete, setDeleteComplete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState("");
  const { navItems } = useSettings(role);
  const { theme, preference, setTheme } = useTheme();
  const { consent, setConsent } = useConsent();
  const deleteModalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);

  const content = useMemo(
    () =>
      role === "creator"
        ? {
          profileHint:
            "This profile appears publicly to fans and potential subscribers.",
          walletLabel: "Creator payout wallet",
          walletAddress: "0xA47bF8934d6a79c161c29d98392B2f2217c2f107",
          walletNote:
            "Payouts are sent to this wallet after each settlement cycle.",
          notifications: [
            "New subscriber alerts",
            "Comment and message activity",
            "Weekly payout summaries",
          ],
          deletionCopy:
            "Deleting a creator account removes profile data, subscription history visibility, and unreleased content drafts.",
        }
        : {
          profileHint:
            "This profile is visible when creators view your engagement and support activity.",
          walletLabel: "Fan payment wallet",
          walletAddress: "0xB06cb7A62Bd658fb6312F6d8Ab2dA7b778bc67c0",
          walletNote:
            "This wallet is used for subscription renewals and one-time support payments.",
          notifications: [
            "Creator post updates",
            "Renewal reminders",
            "Payment receipts",
          ],
          deletionCopy:
            "Deleting a fan account removes saved payment methods, followed creators, and personal notification history.",
        },
    [role]
  );

  const handleCopyWallet = async () => {
    try {
      await navigator.clipboard.writeText(content.walletAddress);
      showSuccess("Address copied", "Wallet address copied to clipboard.");
    } catch {
      showError("UNKNOWN_ERROR", {
        message: "Copy failed",
        description: "Please copy manually.",
      });
    }
  };

  const handleDeleteAccount = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (deleteInput !== "DELETE" || !deletePassword || isDeleting) return;

    setIsDeleting(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setIsDeleting(false);
    setDeleteComplete(true);
    showWarning("Account deleted", "Your account deletion request has been processed.");
  };

  const canDelete = deleteInput === "DELETE" && deletePassword.length >= 6 && !isDeleting;

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setShowDeleteModal(false);
    setDeleteInput("");
    setDeletePassword("");
    setDeleteComplete(false);
    setDeleteError(null);
  };

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (!showDeleteModal) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    // Check if scrollbar is present
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [showDeleteModal]);

  // Focus trap and keyboard handling for delete modal
  useEffect(() => {
    if (!showDeleteModal) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    const modalElement = deleteModalRef.current;

    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const focusFirstElement = () => {
      const firstFocusable = modalElement?.querySelector<HTMLElement>(focusableSelector);
      firstFocusable?.focus();
    };

    // Focus first element after a brief delay
    const focusTimeout = setTimeout(focusFirstElement, 10);

    const handleModalKeyDown = (event: KeyboardEvent) => {
      if (!deleteModalRef.current) return;

      if (event.key === 'Escape' && !isDeleting) {
        closeDeleteModal();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = Array.from(
        deleteModalRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      );
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleModalKeyDown);

    return () => {
      clearTimeout(focusTimeout);
      document.removeEventListener('keydown', handleModalKeyDown);
      deleteTriggerRef.current?.focus();
      if (!deleteTriggerRef.current) {
        previousFocusRef.current?.focus();
      }
    };
  }, [showDeleteModal, isDeleting]);

  const themeOptions: { value: Theme; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'dark', label: 'Dark', icon: '🌙' },
    { value: 'system', label: 'System', icon: '💻' },
  ];

  const renderSection = () => {
    /* ── PROFILE ── */
    if (activeSectionId === "profile") {
      return (
        <ProfileSettingsPanel
          role={role}
          profileHint={content.profileHint}
          onSuccess={(title, message) => showSuccess(title, message)}
          onError={(message) =>
            showError("PROFILE_ERROR", { message, description: message })
          }
        />
      );
    }

    /* ── WALLET ── */
    if (activeSectionId === "wallet") {
      return (
        <section className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
            Wallet
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{content.walletNote}</p>

          <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              {content.walletLabel}
            </p>
            {/* break-all forces the long hex string to wrap instead of overflow */}
            <p className="mt-1 break-all font-mono text-sm text-slate-800 dark:text-slate-200">
              {content.walletAddress}
            </p>
            <button
              className="mt-3 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 transition hover:border-slate-400 dark:hover:border-slate-500 sm:w-auto"
              onClick={handleCopyWallet}
              type="button"
            >
              Copy wallet
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm text-slate-700 dark:text-slate-300">
            {role === "creator"
              ? "Linked payout method: ACH ending in 2291"
              : "Linked payment method: Visa ending in 1144"}
          </div>
        </section>
      );
    }

    /* ── NOTIFICATIONS ── */
    if (activeSectionId === "notifications") {
      return (
        <section className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
            Notifications
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Choose which updates you receive and on which channels.
          </p>
          <div className="mt-5">
            <NotificationPreferencesForm />
          </div>
        </section>
      );
    }

    /* ── APPEARANCE ── */
    if (activeSectionId === "appearance") {
      return (
        <section className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
            Appearance
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Choose how MyFans looks to you. Select a theme or follow your system setting.
          </p>

          <div className="mt-5">
            <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-700/50 p-1">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${preference === option.value
                    ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  type="button"
                  aria-pressed={preference === option.value}
                >
                  <span className="text-base" aria-hidden="true">{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30 p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${theme === 'dark'
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'bg-amber-500/20 text-amber-600'
                }`}>
                {theme === 'dark' ? '🌙' : '☀️'}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Currently using <strong>{theme}</strong> mode
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {preference === 'system'
                    ? 'Following your operating system preference'
                    : `Manually set to ${preference} mode`}
                </p>
              </div>
            </div>
          </div>
        </section>
      );
    }

    /* ── ACCOUNT ── */
    if (activeSectionId === "account") {
      return (
        <section className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
            Account
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Security, access, and account lifecycle controls.
          </p>

          <div className="mt-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/20 p-4">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              Privacy and Data
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Manage your telemetry and analytics consent preferences.
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Enhance experience with telemetry
              </span>
              <button
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${consent ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-600'}`}
                onClick={() => setConsent(!consent)}
                role="switch"
                aria-checked={consent ?? false}
              >
                <span className="sr-only">Toggle telemetry consent</span>
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${consent ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-900/20 p-4">
            <h3 className="text-base font-semibold text-rose-800 dark:text-rose-400">
              Danger zone
            </h3>
            <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">{content.deletionCopy}</p>
            <button
              className="mt-4 w-full rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 sm:w-auto"
              onClick={() => setShowDeleteModal(true)}
              type="button"
              ref={deleteTriggerRef}
            >
              Delete account
            </button>
          </div>
        </section>
      );
    }

    /* ── PAYOUT (creator only) ── */
    if (role === "creator" && activeSectionId === "payout") {
      return (
        <section className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
            Payout Settings
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Control how and when earnings are settled.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:grid sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm text-slate-700 dark:text-slate-300">
              Payout cadence
              <select className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600">
                <option>Weekly</option>
                <option>Bi-weekly</option>
                <option>Monthly</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm text-slate-700 dark:text-slate-300">
              Minimum threshold
              <input
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600"
                defaultValue="$150"
                type="text"
              />
            </label>
          </div>
        </section>
      );
    }

    /* ── CONTENT PREFERENCES (creator only) ── */
    if (role === "creator" && activeSectionId === "content") {
      return (
        <section className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
            Content Preferences
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Set monetization defaults for future posts.
          </p>

          <div className="mt-4 space-y-3">
            <label className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-3 text-sm text-slate-700 dark:text-slate-300">
              Enable paid previews by default
              <input
                className="h-4 w-4 shrink-0 accent-slate-900 dark:accent-slate-100"
                defaultChecked
                type="checkbox"
              />
            </label>
            <label className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-3 text-sm text-slate-700 dark:text-slate-300">
              Auto-archive expired promotions
              <input
                className="h-4 w-4 shrink-0 accent-slate-900 dark:accent-slate-100"
                defaultChecked
                type="checkbox"
              />
            </label>
          </div>
        </section>
      );
    }

    /* ── CREATOR VISIBILITY (creator only) ── */
    if (role === "creator" && activeSectionId === "visibility") {
      return (
        <section className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
            Creator Visibility
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Manage discoverability and public profile visibility.
          </p>
          <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm text-slate-700 dark:text-slate-300">
            Current mode: Public profile + searchable.
          </div>
        </section>
      );
    }

    /* ── SUBSCRIPTIONS (fan only) ── */
    if (role === "fan" && activeSectionId === "subscriptions") {
      return (
        <section className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
            Subscription Management
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Manage your active plans and renewal preferences.
          </p>
          <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm text-slate-700 dark:text-slate-300">
            2 active subscriptions, next renewal on March 4.
          </div>
        </section>
      );
    }

    /* ── FOLLOWED CREATORS (fan only) ── */
    if (role === "fan" && activeSectionId === "followed") {
      return (
        <section className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
            Followed Creators
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Your followed list and notification priorities.
          </p>
          <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm text-slate-700 dark:text-slate-300">
            Following 18 creators across music and design.
          </div>
        </section>
      );
    }

    /* ── SPENDING HISTORY (fan only) ── */
    if (role === "fan" && activeSectionId === "spending") {
      return (
        <section className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
            Spending History
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Review recent support and subscription activity.
          </p>
          <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm text-slate-700 dark:text-slate-300">
            Last 30 days: $84.50 total across subscriptions and tips.
          </div>
        </section>
      );
    }

    return null;
  };

  return (
    <SettingsShell
      activeSectionId={activeSectionId}
      navItems={navItems}
      role={role}
      onSectionChange={setActiveSectionId}
      onRoleChange={(nextRole) => {
        setRole(nextRole);
        setActiveSectionId("profile");
        setDeleteInput("");
        setDeleteComplete(false);
      }}
    >
      {/* Wrapper ensures section never bleeds past its column */}
      <div className="w-full min-w-0">{renderSection()}</div>

      {/* Delete confirmation modal */}
      {showDeleteModal ? (
        <div 
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 dark:bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          aria-describedby="delete-modal-description"
        >
          <div 
            ref={deleteModalRef}
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 p-4 shadow-xl sm:p-5 focus:outline-none"
          >
            {!deleteComplete ? (
              <>
                <h3 
                  id="delete-modal-title"
                  className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg"
                >
                  Confirm account deletion
                </h3>
                <div id="delete-modal-description">
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    This action is <strong>irreversible</strong>. You will lose access to:
                  </p>
                  <ul className="mt-2 list-disc pl-5 text-sm text-slate-600 dark:text-slate-400">
                    <li>Your public profile and bio</li>
                    <li>Subscription history and analytics</li>
                    <li>Any unreleased content drafts</li>
                    {role === "fan" && <li>Followed creators and saved content</li>}
                    {role === "creator" && <li>Creator payout history and unwithdrawn funds</li>}
                  </ul>
                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                    To proceed, type <strong>DELETE</strong> and enter your password.
                  </p>
                </div>

                <form className="mt-4 space-y-3" onSubmit={handleDeleteAccount}>
                  <label htmlFor="delete-confirmation-input" className="sr-only">
                    Type DELETE to confirm
                  </label>
                  <input
                    id="delete-confirmation-input"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600"
                    onChange={(e) => setDeleteInput(e.target.value)}
                    placeholder="Type DELETE"
                    type="text"
                    value={deleteInput}
                    aria-required="true"
                  />
                  <label htmlFor="delete-password-input" className="sr-only">
                    Enter your password
                  </label>
                  <input
                    id="delete-password-input"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600"
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter your password"
                    type="password"
                    value={deletePassword}
                    aria-required="true"
                  />
                  {deleteError && (
                    <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">{deleteError}</p>
                  )}
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 sm:w-auto"
                      onClick={closeDeleteModal}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="w-full rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-rose-300 sm:w-auto"
                      disabled={!canDelete}
                      type="submit"
                      aria-disabled={!canDelete}
                    >
                      {isDeleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="py-2 text-center">
                <p className="text-3xl" aria-hidden="true">👋</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400" role="status">
                  Your deletion request has been successfully submitted.
                </p>
                <button
                  className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white sm:w-auto"
                  onClick={closeDeleteModal}
                  type="button"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </SettingsShell>
  );
}
