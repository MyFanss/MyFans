"use client";

import Link from "next/link";
import { FanQuickstartCards } from "@/components/onboarding/FanQuickstartCards";
import { useFanQuickstart } from "@/hooks/useFanQuickstart";

export default function FanOnboardingPage() {
  const { isComplete, reset } = useFanQuickstart();

  if (isComplete) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12 dark:bg-slate-950">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl dark:bg-emerald-900/40">
            ✓
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            You&apos;re set
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Wallet linked and first sub done. Explore more anytime.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/discover"
              className="inline-flex justify-center rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
            >
              Discover more
            </Link>
            <Link
              href="/"
              className="inline-flex justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Home
            </Link>
          </div>
          <button
            type="button"
            onClick={reset}
            className="mt-6 text-xs text-slate-500 underline hover:text-slate-700 dark:hover:text-slate-300"
          >
            Reset quickstart (demo)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950 sm:py-14">
      <div className="mx-auto max-w-xl">
        <header className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
            Fan quickstart
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            Subscribe in 3 steps
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Short path: wallet → browse → subscribe. Skip nothing required
            except your first sub when you&apos;re ready.
          </p>
        </header>

        <FanQuickstartCards />

        <p className="mt-8 text-center text-xs text-slate-500 dark:text-slate-500">
          Progress saves on this device.{" "}
          <Link href="/onboarding" className="text-sky-600 underline dark:text-sky-400">
            Full account setup
          </Link>
        </p>
      </div>
    </div>
  );
}
