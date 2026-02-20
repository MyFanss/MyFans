import { useMemo } from "react";
import type { SettingsNavItem } from "@/components/settings/settings-shell";

type Role = "creator" | "fan";

const sharedSections: SettingsNavItem[] = [
  { id: "profile", label: "Profile" },
  { id: "wallet", label: "Wallet" },
  { id: "notifications", label: "Notifications" },
  { id: "account", label: "Account" },
];

const creatorSections: SettingsNavItem[] = [
  { id: "payout", label: "Payout Settings" },
  { id: "content", label: "Content Preferences" },
  { id: "visibility", label: "Creator Visibility" },
];

const fanSections: SettingsNavItem[] = [
  { id: "subscriptions", label: "Subscriptions" },
  { id: "followed", label: "Followed Creators" },
  { id: "spending", label: "Spending History" },
];

export function useSettings(role: Role) {
  return useMemo(() => {
    const roleSections = role === "creator" ? creatorSections : fanSections;
    return {
      navItems: [...sharedSections, ...roleSections],
    };
  }, [role]);
}

export type { Role };
