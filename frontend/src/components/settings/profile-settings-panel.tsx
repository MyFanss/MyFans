"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchMe,
  patchMe,
  patchCreatorMe,
  type MeResponse,
} from "@/lib/api/profile";
import { resolveUserId } from "@/lib/auth-storage";
import {
  validateDisplayName,
  validateHttpsUrl,
  validateUsername,
} from "@/lib/validation/profile";
import { SocialLinksForm } from "@/components/settings/social-links-form";
import type { Role } from "@/components/settings/use-settings";

type Props = {
  role: Role;
  profileHint: string;
  onSuccess: (title: string, message: string) => void;
  onError: (message: string) => void;
};

export function ProfileSettingsPanel({
  role,
  profileHint,
  onSuccess,
  onError,
}: Props) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [subscriptionPrice, setSubscriptionPrice] = useState("");
  const [currency, setCurrency] = useState<"XLM" | "USDC">("XLM");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const id = resolveUserId();
    if (!id) {
      setLoadError(
        "No user session. Log in or set localStorage key myfans_user_id (or NEXT_PUBLIC_DEV_USER_ID)."
      );
      setLoading(false);
      return;
    }
    setLoadError(null);
    setLoading(true);
    try {
      const data = await fetchMe();
      setMe(data);
      setDisplayName(data.display_name ?? "");
      setUsername(data.username ?? "");
      setAvatarUrl(data.avatar_url ?? "");
      setBio(data.creator?.bio ?? "");
      setBannerUrl(data.creator?.banner_url ?? "");
      setSubscriptionPrice(data.creator?.subscription_price ?? "0");
      setCurrency((data.creator?.currency as "XLM" | "USDC") ?? "XLM");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const showCreatorFields = me?.is_creator === true;

  const validateUserFields = (): boolean => {
    const next: Record<string, string> = {};
    const u = validateUsername(username);
    if (u) next.username = u;
    const d = validateDisplayName(displayName);
    if (d) next.display_name = d;
    const a = validateHttpsUrl(avatarUrl, "Avatar");
    if (a) next.avatar_url = a;
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me || !validateUserFields()) {
      onError("Please fix the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      const userPayload: Parameters<typeof patchMe>[0] = {
        display_name: displayName.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
      };
      const u = username.trim();
      if (u) userPayload.username = u;

      const updated = await patchMe(userPayload);
      setMe(updated);

      if (showCreatorFields) {
        const price = parseFloat(subscriptionPrice);
        if (Number.isNaN(price) || price < 0) {
          onError("Subscription price must be a non-negative number.");
          setSaving(false);
          return;
        }
        const bErr = validateHttpsUrl(bannerUrl, "Banner");
        if (bErr) {
          setFieldErrors((f) => ({ ...f, banner_url: bErr }));
          onError(bErr);
          setSaving(false);
          return;
        }
        await patchCreatorMe({
          bio: bio.trim() || undefined,
          subscription_price: price,
          currency,
          banner_url: bannerUrl.trim() || undefined,
        });
        const again = await fetchMe();
        setMe(again);
      }

      onSuccess(
        "Profile saved",
        showCreatorFields
          ? "Your fan and creator profile details were updated."
          : "Your profile was updated."
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSocialSubmit = async (links: {
    website: string;
    x: string;
    instagram: string;
    other: string;
  }) => {
    if (!me) return;
    setSaving(true);
    try {
      const updated = await patchMe({
        website_url: links.website.trim() || undefined,
        x_handle: links.x.trim() || undefined,
        instagram_handle: links.instagram.trim() || undefined,
        other_url: links.other.trim() || undefined,
      });
      setMe(updated);
      onSuccess("Social links updated", "Your links were saved.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save links");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">Loading profile…</p>
    );
  }

  if (loadError) {
    return (
      <div
        className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        role="alert"
      >
        {loadError}
      </div>
    );
  }

  if (!me) return null;

  return (
    <div className="space-y-8">
      <section className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
          Profile
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {profileHint}
        </p>
        {role === "creator" && !showCreatorFields && (
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
            Previewing creator UI: your account is not a creator yet. Fan fields
            still save to your user profile.
          </p>
        )}

        <form onSubmit={handleSaveProfile} className="mt-4 flex flex-col gap-3 sm:grid sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm text-slate-700 dark:text-slate-300 sm:col-span-1">
            Display name
            <input
              className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              type="text"
              autoComplete="name"
            />
            {fieldErrors.display_name && (
              <span className="text-xs text-red-600">{fieldErrors.display_name}</span>
            )}
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-slate-700 dark:text-slate-300">
            Username
            <input
              className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              type="text"
              autoComplete="username"
            />
            {fieldErrors.username && (
              <span className="text-xs text-red-600">{fieldErrors.username}</span>
            )}
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-slate-700 dark:text-slate-300 sm:col-span-2">
            Email
            <input
              className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-600 px-3 py-2 text-slate-600 dark:text-slate-300"
              value={me.email}
              readOnly
              type="email"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-slate-700 dark:text-slate-300 sm:col-span-2">
            Avatar image URL
            <input
              className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…"
              type="url"
            />
            {fieldErrors.avatar_url && (
              <span className="text-xs text-red-600">{fieldErrors.avatar_url}</span>
            )}
          </label>

          {showCreatorFields && (
            <>
              <label className="flex flex-col gap-1.5 text-sm text-slate-700 dark:text-slate-300 sm:col-span-2">
                Bio
                <textarea
                  className="w-full min-h-[90px] rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={2000}
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                Banner image URL
                <input
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  placeholder="https://…"
                  type="url"
                />
                {fieldErrors.banner_url && (
                  <span className="text-xs text-red-600">{fieldErrors.banner_url}</span>
                )}
              </label>

              <label className="flex flex-col gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                Subscription price
                <input
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600"
                  value={subscriptionPrice}
                  onChange={(e) => setSubscriptionPrice(e.target.value)}
                  inputMode="decimal"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                Currency
                <select
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600"
                  value={currency}
                  onChange={(e) =>
                    setCurrency(e.target.value as "XLM" | "USDC")
                  }
                >
                  <option value="XLM">XLM</option>
                  <option value="USDC">USDC</option>
                </select>
              </label>
            </>
          )}

          <div className="flex justify-end sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-slate-900 dark:bg-slate-100 px-6 py-2.5 text-sm font-semibold text-white dark:text-slate-900 transition hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </section>

      <section className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
          Social links
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Website and links must use <code className="text-xs">http://</code> or{" "}
          <code className="text-xs">https://</code>. Handles support @prefix.
        </p>
        <div className="mt-4">
          <SocialLinksForm
            initialValues={{
              website: me.website_url ?? "",
              x: me.x_handle ? `@${me.x_handle}` : "",
              instagram: me.instagram_handle ? `@${me.instagram_handle}` : "",
              other: me.other_url ?? "",
            }}
            onSubmit={handleSocialSubmit}
            disabled={saving}
          />
        </div>
      </section>
    </div>
  );
}
