"use client";

import React from "react";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";

interface TransactionProgressProps {
  stage: "signing" | "pending" | "confirmed" | "failed";
  txHash?: string;
  error?: string;
  onRetry?: () => void;
}

export default function TransactionProgress({
  stage,
  txHash,
  error,
  onRetry,
}: TransactionProgressProps) {
  const explorerBase = "https://explorer.example.com/tx"; // Replace with your actual explorer

  return (
    <div className="space-y-4 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      {/* Steps */}
      <div className="flex items-center gap-4">
        {["signing", "pending", "confirmed"].map((s, idx) => {
          const isActive = stage === s;
          const isCompleted =
            stage === "confirmed" ||
            idx < ["signing", "pending", "confirmed"].indexOf(stage);
          return (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center ${
                  isCompleted
                    ? "bg-green-500 text-white"
                    : isActive
                      ? "bg-blue-500 text-white animate-pulse"
                      : "bg-slate-300 text-slate-500 dark:bg-slate-700"
                }`}
              >
                {isCompleted ? (
                  <CheckCircleIcon className="h-4 w-4" />
                ) : (
                  <span className="text-xs">{idx + 1}</span>
                )}
              </div>
              <span
                className={
                  isActive
                    ? "font-medium"
                    : "text-slate-500 dark:text-slate-400"
                }
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Messages */}
      <div>
        {stage === "signing" && <p>Signing transaction...</p>}
        {stage === "pending" && <p>Transaction is being processed...</p>}
        {stage === "confirmed" && (
          <p>
            Transaction confirmed!{" "}
            {txHash && (
              <a
                href={`${explorerBase}/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                {txHash}
              </a>
            )}
          </p>
        )}
        {stage === "failed" && (
          <div className="space-y-2">
            <p className="text-red-600 dark:text-red-400">
              Transaction failed: {error}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
