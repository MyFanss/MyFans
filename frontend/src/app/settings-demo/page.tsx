"use client";

import { useState } from "react";
import { SettingsShell } from "@/components/settings/settings-shell";
import { SocialLinksForm } from "@/components/settings/social-links-form";

type Role = "creator" | "fan";

const navItems = [
  { id: "profile", label: "Profile" },
  { id: "social", label: "Social Links" },
  { id: "notifications", label: "Notifications" },
  { id: "security", label: "Security" },
  { id: "billing", label: "Billing" },
];

export default function SocialLinksDemoPage() {
  const [role, setRole] = useState<Role>("creator");
  const [activeSectionId, setActiveSectionId] = useState("social");

  const handleSocialLinksSubmit = (links: {
    website: string;
    x: string;
    instagram: string;
    other: string;
  }) => {
    console.log("Social links saved:", links);
    alert(
      `Social links saved!\n\nWebsite: ${links.website || "(empty)"}\nX: ${links.x || "(empty)"}\nInstagram: ${links.instagram || "(empty)"}\nOther: ${links.other || "(empty)"}`,
    );
  };

  return (
    <SettingsShell
      role={role}
      navItems={navItems}
      activeSectionId={activeSectionId}
      onSectionChange={setActiveSectionId}
      onRoleChange={setRole}
    >
      {activeSectionId === "social" ? (
        <div className="max-w-xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Social Links
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Add your social media links to help fans connect with you.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <SocialLinksForm
              initialValues={{
                website: "https://mywebsite.com",
                x: "@myhandle",
                instagram: "myinstagram",
                other: "",
              }}
              onSubmit={handleSocialLinksSubmit}
            />
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-slate-600 dark:text-slate-400">
            This section is under construction. Click &quot;Social Links&quot; to test the
            form.
          </p>
        </div>
      )}
    </SettingsShell>
  );
}
