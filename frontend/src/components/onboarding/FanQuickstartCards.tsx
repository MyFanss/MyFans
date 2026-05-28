"use client";

import Link from "next/link";
import WalletConnect from "@/components/WalletConnect";
import {
  FAN_QUICKSTART_SUBSCRIBE_URL,
  useFanQuickstart,
} from "@/hooks/useFanQuickstart";
import type { FanQuickstartStep } from "@/lib/fan-quickstart";

type CardProps = {
  step: 1 | 2 | 3;
  title: string;
  body: string;
  done: boolean;
  active: boolean;
  children: React.ReactNode;
};

function QuickstartCard({
  step,
  title,
  body,
  done,
  active,
  children,
}: CardProps) {
  return (
    <article
      className={`rounded-2xl border p-5 transition-shadow sm:p-6 ${
        done
          ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/50 dark:bg-emerald-950/30"
          : active
          ? "border-sky-400 bg-white shadow-md ring-2 ring-sky-200 dark:border-sky-600 dark:bg-slate-900 dark:ring-sky-900/40"
          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/50"
      }`}
      aria-current={active ? "step" : undefined}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            done
              ? "bg-emerald-600 text-white"
              : active
              ? "bg-sky-600 text-white"
              : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
          }`}
        >
          {done ? "✓" : step}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{body}</p>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </article>
  );
}

export function FanQuickstartCards() {
  const { state, markStep, isComplete, firstIncomplete } = useFanQuickstart();

  const active = (s: FanQuickstartStep) =>
    !isComplete && firstIncomplete === s;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <QuickstartCard
        step={1}
        title="Connect wallet"
        body="Pay with Stellar. Takes a few seconds."
        done={state.wallet}
        active={active("wallet")}
      >
        {state.wallet ? (
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
            Wallet ready.
          </p>
        ) : (
          <WalletConnect
            className="p-0"
            onConnect={() => markStep("wallet")}
          />
        )}
      </QuickstartCard>

      <QuickstartCard
        step={2}
        title="Pick a creator"
        body="Browse and choose who to support."
        done={state.explore}
        active={active("explore")}
      >
        {state.explore ? (
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
            Creators opened.
          </p>
        ) : (
          <Link
            href={FAN_QUICKSTART_SUBSCRIBE_URL}
            className="inline-flex rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            Browse creators
          </Link>
        )}
      </QuickstartCard>

      <QuickstartCard
        step={3}
        title="Subscribe"
        body="Tap Subscribe on any card — we’ll check it off here."
        done={state.subscribe}
        active={active("subscribe")}
      >
        {state.subscribe ? (
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
            First subscription done.
          </p>
        ) : (
          <Link
            href={FAN_QUICKSTART_SUBSCRIBE_URL}
            className="inline-flex rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Go subscribe
          </Link>
        )}
      </QuickstartCard>
    </div>
  );
}
