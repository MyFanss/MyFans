"use client";

import Link from "next/link";
import { useOnboarding } from "@/hooks";

/**
 * Shown on creator dashboard when onboarding was started but not finished.
 * Lets creators resume the multi-step flow without losing progress.
 */
export function OnboardingResumeBanner() {
  const { isComplete, progressCount, totalSteps, onboardingIntent } =
    useOnboarding();

  if (isComplete) return null;
  if (progressCount === 0) return null;

  const isCreatorPath =
    onboardingIntent === "creator" || onboardingIntent === "both";

  return (
    <div
      className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-800 dark:bg-sky-950/50"
      role="status"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-sky-900 dark:text-sky-100">
          <span className="font-semibold">
            {isCreatorPath ? "Finish your creator setup" : "Finish setting up your account"}
          </span>
          <span className="text-sky-800 dark:text-sky-200">
            {" "}
            — {progressCount} of {totalSteps} steps done. You can skip steps anytime;
            progress is saved on this device.
          </span>
        </p>
        <Link
          href="/onboarding"
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
        >
          Resume setup
        </Link>
      </div>
    </div>
  );
}
