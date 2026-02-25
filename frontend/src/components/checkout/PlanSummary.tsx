"use client";

import { PlanSummary as PlanSummaryType } from "@/lib/checkout";

interface PlanSummaryProps {
  plan: PlanSummaryType;
}

export default function PlanSummary({ plan }: PlanSummaryProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
        Plan Summary
      </h3>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Creator</span>
          <span className="text-slate-900 dark:text-slate-100">
            {plan.creatorName}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Plan</span>
          <span className="text-slate-900 dark:text-slate-100">
            {plan.name}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Interval</span>
          <span className="text-slate-900 dark:text-slate-100">
            {plan.interval}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Amount</span>
          <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {plan.amount} {plan.assetCode}
          </span>
        </div>

        {plan.description && (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {plan.description}
          </p>
        )}
      </div>
    </div>
  );
}
