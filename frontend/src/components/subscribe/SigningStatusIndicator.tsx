'use client';

export default function SigningStatusIndicator() {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
      <p className="text-sm text-slate-600">Waiting for wallet approval…</p>
    </div>
  );
}
