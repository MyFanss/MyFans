"use client";

import { PriceBreakdown as PriceBreakdownType } from "@/lib/checkout";

interface PriceBreakdownProps {
  breakdown: PriceBreakdownType;
}

export default function PriceBreakdown({ breakdown }: PriceBreakdownProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
        Price Breakdown
      </h3>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Subtotal</span>
          <span className="text-slate-900 dark:text-slate-100">
            {breakdown.subtotal} {breakdown.currency}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">
            Platform Fee
          </span>
          <span className="text-slate-900 dark:text-slate-100">
            {breakdown.platformFee} {breakdown.currency}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">
            Network Fee (est.)
          </span>
          <span className="text-slate-900 dark:text-slate-100">
            {breakdown.networkFee} {breakdown.currency}
          </span>
        </div>

        <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
          <div className="flex justify-between">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              Total
            </span>
            <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
              {breakdown.total} {breakdown.currency}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
