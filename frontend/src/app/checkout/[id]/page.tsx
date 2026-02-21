"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import CheckoutFlow from "@/components/checkout/CheckoutFlow";
import WalletConnect from "@/components/WalletConnect";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getConnectedAddress } from "@/lib/wallet";

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const checkoutId = searchParams.get("id");
  const planId = searchParams.get("planId");
  const creatorAddress = searchParams.get("creator");

  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing wallet connection on mount
  useEffect(() => {
    async function checkWallet() {
      try {
        const connectedAddress = await getConnectedAddress();
        setAddress(connectedAddress);
      } catch {
        setAddress(null);
      } finally {
        setIsLoading(false);
      }
    }
    checkWallet();
  }, []);

  const handleWalletConnect = (newAddress: string) => {
    setAddress(newAddress);
  };

  const handleWalletDisconnect = () => {
    setAddress(null);
  };

  // If no checkout ID, show error
  if (!checkoutId) {
    return (
      <div className="min-h-screen bg-white p-8 dark:bg-slate-900">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Checkout
          </h1>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <WalletConnect
              onConnect={handleWalletConnect}
              onDisconnect={handleWalletDisconnect}
            />
          </div>
        </header>

        <div className="mx-auto max-w-2xl">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-900/20">
            <p className="text-red-700 dark:text-red-300">
              Invalid checkout session. Please start a new subscription.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // While checking for wallet connection
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // If wallet not connected, show connection prompt
  if (!address) {
    return (
      <div className="min-h-screen bg-white p-8 dark:bg-slate-900">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Checkout
          </h1>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <WalletConnect
              onConnect={handleWalletConnect}
              onDisconnect={handleWalletDisconnect}
            />
          </div>
        </header>

        <div className="mx-auto max-w-2xl">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-800 dark:bg-amber-900/20">
            <h2 className="mb-2 text-xl font-semibold text-amber-800 dark:text-amber-200">
              Connect Your Wallet
            </h2>
            <p className="text-amber-700 dark:text-amber-300">
              Please connect your wallet to continue with the checkout process.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <header className="mb-6 border-b border-slate-200 p-4 dark:border-slate-700">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Complete Your Subscription
          </h1>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <WalletConnect
              onConnect={handleWalletConnect}
              onDisconnect={handleWalletDisconnect}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-4">
        <CheckoutFlow
          fanAddress={address}
          creatorAddress={creatorAddress || "GAAAAAAAAAAAAAAA"}
          planId={parseInt(planId || "1", 10)}
          onComplete={(result) => {
            console.log("Checkout completed:", result);
            if (result.success) {
              window.location.href = "/pending";
            }
          }}
          onCancel={() => {
            window.location.href = "/subscribe";
          }}
        />
      </main>
    </div>
  );
}
