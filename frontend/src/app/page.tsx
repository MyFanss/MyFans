import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">MyFans</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Settings Workspace</h1>
        <p className="mt-3 text-sm text-slate-600">
          Open the new creator and fan settings flow with role-based sections and secure account deletion confirmation.
        </p>
        <Link
          className="mt-6 inline-flex rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
          href="/settings"
        >
          Open settings
        </Link>
      </div>
    </main>
  );
}
