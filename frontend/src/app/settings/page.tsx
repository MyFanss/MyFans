"use client";

import { useMemo, useState } from "react";
import { SettingsShell } from "@/components/settings/settings-shell";
import { useSettings, type Role } from "@/components/settings/use-settings";
import { SocialLinksForm } from "@/components/settings/social-links-form";

export default function SettingsPage() {
  const [role, setRole] = useState<Role>("creator");
  const [copyFeedback, setCopyFeedback] = useState<string>("");
  const [activeSectionId, setActiveSectionId] = useState("profile");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteComplete, setDeleteComplete] = useState(false);
  const { navItems } = useSettings(role);

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
      setCopyFeedback("Wallet address copied.");
    } catch {
      setCopyFeedback("Copy failed. Please copy manually.");
    }
  };

  const handleDeleteAccount = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (deleteInput !== "DELETE" || isDeleting) return;
    setIsDeleting(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setIsDeleting(false);
    setDeleteComplete(true);
  };

  const canDelete = deleteInput === "DELETE" && !isDeleting;

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setShowDeleteModal(false);
    setDeleteInput("");
    setDeleteComplete(false);
  };

  const renderSection = () => {
    /* ── PROFILE ── */
    if (activeSectionId === "profile") {
      return (
        <section className="w-full rounded-2xl border border-slate-200 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
            Profile
          </h2>
          <p className="mt-1 text-sm text-slate-600">{content.profileHint}</p>

          <div className="mt-4 flex flex-col gap-3 sm:grid sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm text-slate-700">
              Display name
              <input
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-slate-300"
                defaultValue={
                  role === "creator" ? "@star.creator" : "@fan.nova"
                }
                type="text"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm text-slate-700">
              Email
              <input
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-slate-300"
                defaultValue={
                  role === "creator" ? "creator@myfans.app" : "fan@myfans.app"
                }
                type="email"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm text-slate-700 sm:col-span-2">
              Bio
              <textarea
                className="w-full min-h-[90px] rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-slate-300"
                defaultValue={
                  role === "creator"
                    ? "Indie creator sharing early drops and behind-the-scenes clips."
                    : "Supporter of music and visual creators."
                }
              />
            </label>
          </div>
        </section>
      );
    }

    /* ── SOCIAL LINKS ── */
    if (activeSectionId === "social") {
      const handleSocialLinksSubmit = (links: {
        website: string;
        x: string;
        instagram: string;
        other: string;
      }) => {
        console.log("Social links saved:", links);
        // Here you would typically save to your backend
      };

      return (
        <section className="w-full rounded-2xl border border-slate-200 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
            Social Links
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Add your social media profiles to help fans connect with you.
          </p>
          <div className="mt-4">
            <SocialLinksForm onSubmit={handleSocialLinksSubmit} />
          </div>
        </section>
      );
    }

    /* ── WALLET ── */
    if (activeSectionId === "wallet") {
      return (
        <section className="w-full rounded-2xl border border-slate-200 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
            Wallet
          </h2>
          <p className="mt-1 text-sm text-slate-600">{content.walletNote}</p>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
              {content.walletLabel}
            </p>
            {/* break-all forces the long hex string to wrap instead of overflow */}
            <p className="mt-1 break-all font-mono text-sm text-slate-800">
              {content.walletAddress}
            </p>
            <button
              className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-slate-400 sm:w-auto"
              onClick={handleCopyWallet}
              type="button"
            >
              Copy wallet
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
            {role === "creator"
              ? "Linked payout method: ACH ending in 2291"
              : "Linked payment method: Visa ending in 1144"}
          </div>

          {copyFeedback ? (
            <p className="mt-2 text-sm text-emerald-700">{copyFeedback}</p>
          ) : null}
        </section>
      );
    }

    /* ── NOTIFICATIONS ── */
    if (activeSectionId === "notifications") {
      return (
        <section className="w-full rounded-2xl border border-slate-200 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
            Notifications
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Choose which updates you receive in email, push, and in-app
            channels.
          </p>

          <div className="mt-4 space-y-3">
            {content.notifications.map((item) => (
              <label
                className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700"
                key={item}
              >
                <span>{item}</span>
                <input
                  className="h-4 w-4 shrink-0 accent-slate-900"
                  defaultChecked
                  type="checkbox"
                />
              </label>
            ))}
          </div>
        </section>
      );
    }

    /* ── ACCOUNT ── */
    if (activeSectionId === "account") {
      return (
        <section className="w-full rounded-2xl border border-slate-200 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
            Account
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Security, access, and account lifecycle controls.
          </p>

          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <h3 className="text-base font-semibold text-rose-800">
              Danger zone
            </h3>
            <p className="mt-1 text-sm text-rose-700">{content.deletionCopy}</p>
            <button
              className="mt-4 w-full rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 sm:w-auto"
              onClick={() => setShowDeleteModal(true)}
              type="button"
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
        <section className="w-full rounded-2xl border border-slate-200 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
            Payout Settings
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Control how and when earnings are settled.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:grid sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm text-slate-700">
              Payout cadence
              <select className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-slate-300">
                <option>Weekly</option>
                <option>Bi-weekly</option>
                <option>Monthly</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm text-slate-700">
              Minimum threshold
              <input
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-slate-300"
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
        <section className="w-full rounded-2xl border border-slate-200 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
            Content Preferences
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Set monetization defaults for future posts.
          </p>

          <div className="mt-4 space-y-3">
            <label className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700">
              Enable paid previews by default
              <input
                className="h-4 w-4 shrink-0 accent-slate-900"
                defaultChecked
                type="checkbox"
              />
            </label>
            <label className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700">
              Auto-archive expired promotions
              <input
                className="h-4 w-4 shrink-0 accent-slate-900"
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
        <section className="w-full rounded-2xl border border-slate-200 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
            Creator Visibility
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Manage discoverability and public profile visibility.
          </p>
          <div className="mt-4 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
            Current mode: Public profile + searchable.
          </div>
        </section>
      );
    }

    /* ── SUBSCRIPTIONS (fan only) ── */
    if (role === "fan" && activeSectionId === "subscriptions") {
      return (
        <section className="w-full rounded-2xl border border-slate-200 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
            Subscription Management
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Manage your active plans and renewal preferences.
          </p>
          <div className="mt-4 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
            2 active subscriptions, next renewal on March 4.
          </div>
        </section>
      );
    }

    /* ── FOLLOWED CREATORS (fan only) ── */
    if (role === "fan" && activeSectionId === "followed") {
      return (
        <section className="w-full rounded-2xl border border-slate-200 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
            Followed Creators
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Your followed list and notification priorities.
          </p>
          <div className="mt-4 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
            Following 18 creators across music and design.
          </div>
        </section>
      );
    }

    /* ── SPENDING HISTORY (fan only) ── */
    if (role === "fan" && activeSectionId === "spending") {
      return (
        <section className="w-full rounded-2xl border border-slate-200 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
            Spending History
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Review recent support and subscription activity.
          </p>
          <div className="mt-4 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
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
        setCopyFeedback("");
      }}
    >
      {/* Wrapper ensures section never bleeds past its column */}
      <div className="w-full min-w-0">{renderSection()}</div>

      {/* Delete confirmation modal */}
      {showDeleteModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl sm:p-5">
            {!deleteComplete ? (
              <>
                <h3 className="text-base font-semibold text-slate-900 sm:text-lg">
                  Confirm account deletion
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Type <strong>DELETE</strong> exactly to continue. This action
                  is permanent.
                </p>

                <form className="mt-4 space-y-3" onSubmit={handleDeleteAccount}>
                  <input
                    className="w-full rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-rose-300 focus:ring-2 focus:ring-rose-300"
                    onChange={(e) => setDeleteInput(e.target.value)}
                    placeholder="Type DELETE"
                    type="text"
                    value={deleteInput}
                  />
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 sm:w-auto"
                      onClick={closeDeleteModal}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="w-full rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-rose-300 sm:w-auto"
                      disabled={!canDelete}
                      type="submit"
                    >
                      {isDeleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="py-2 text-center">
                <p className="text-3xl">Goodbye</p>
                <p className="mt-2 text-sm text-slate-600">
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
