'use client';

export default function PollingStatusIndicator() {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="flex items-center gap-1">
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500 [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500 [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500" />
      </div>
      <p className="text-sm text-slate-600">Confirming your subscription on-chain…</p>
    </div>
  );
}
