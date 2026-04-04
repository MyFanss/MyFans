"use client";

type Stage = "signing" | "pending" | "confirmed" | "failed";

interface TransactionProgressProps {
  stage: Stage;
  txHash?: string;
  error?: string;
  onRetry?: () => void;
}

const LABELS: Record<Stage, string> = {
  signing: "Waiting for signature…",
  pending: "Submitting transaction…",
  confirmed: "Transaction confirmed",
  failed: "Transaction failed",
};

export default function TransactionProgress({
  stage,
  txHash,
  error,
  onRetry,
}: TransactionProgressProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {LABELS[stage]}
      </p>
      {txHash && (
        <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
          Tx: {txHash}
        </p>
      )}
      {stage === "failed" && error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      {stage === "failed" && onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
        >
          Retry
        </button>
      )}
    </div>
  );
}
