"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { WalletSelectionModal } from "@/components/wallet/WalletSelectionModal";
import { useWallet } from "@/hooks/useWallet";

export const metadata = {
  title: "Sign in | MyFans",
  description: "Sign in with your wallet to access protected MyFans pages.",
};

export default function AuthSignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get("redirectTo") ?? "/dashboard";
  const wallet = useWallet();

  useEffect(() => {
    if (wallet.isConnected) {
      router.replace(redirectTo);
    }
  }, [wallet.isConnected, redirectTo, router]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-10 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="space-y-5 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600">
            Secure access
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            Sign in to continue
          </h1>
          <p className="mx-auto max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            Connect your Stellar wallet to unlock the creator dashboard, profile
            settings, notifications, and other protected pages.
          </p>
        </div>

        <div className="mt-10 space-y-6">
          <button
            type="button"
            onClick={wallet.openModal}
            className="w-full rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
          >
            {wallet.isConnected ? "Signing you in…" : "Connect wallet"}
          </button>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            If you already connected your wallet, we will send you back to your
            destination automatically.
          </p>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              Destination after sign in
            </p>
            <p className="mt-2 break-all text-slate-600 dark:text-slate-400">
              {redirectTo}
            </p>
          </div>

          <div className="text-center text-sm text-slate-500 dark:text-slate-400">
            <Link
              href="/"
              className="font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
            >
              Go back to public home
            </Link>
          </div>
        </div>
      </div>

      <WalletSelectionModal
        isOpen={wallet.isModalOpen}
        onClose={wallet.closeModal}
        onConnect={() => router.replace(redirectTo)}
        onDisconnect={() => {
          /* keep UI state in sync */
        }}
        isWalletInstalled={wallet.isWalletInstalled}
        getInstallUrl={wallet.getInstallUrl}
      />
    </div>
  );
}
