"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Button from "@/components/Button";
import { WalletSelectionModal } from "@/components/wallet/WalletSelectionModal";
import type { WalletType } from "@/types/wallet";

/**
 * Hero section for the MyFans landing page
 * Value proposition: MyFans Content Subscription Platform
 */
export function Hero() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleGetStarted = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleWalletConnect = useCallback(
    (address: string, walletType: WalletType) => {
      console.log("Connected wallet:", address, walletType);
      // Optionally redirect to signup/dashboard
    },
    [],
  );

  return (
    <>
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:rounded-md focus:bg-primary-500 focus:px-4 focus:py-2 focus:text-white focus:font-medium"
      >
        Skip to main content
      </a>

      <section
        className="relative overflow-hidden min-h-[calc(100vh-4rem)] flex items-center justify-center"
        aria-labelledby="hero-heading"
      >
        {/* Gradient background */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-surface-900 dark:via-surface-800 dark:to-surface-900"
          aria-hidden="true"
        />

        {/* Decorative gradient orbs - with reduced motion support */}
        <div
          className="absolute -top-1/4 -right-1/4 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-primary-400/20 to-primary-600/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-1/4 -left-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-primary-300/20 to-primary-500/10 blur-3xl"
          aria-hidden="true"
        />

        {/* Main content */}
        <div className="relative z-10 w-full max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center rounded-full border border-primary-200 bg-primary-50/50 px-4 py-1.5 text-sm font-medium text-primary-700 backdrop-blur-sm dark:border-primary-800 dark:bg-primary-900/30 dark:text-primary-300">
              <span className="mr-2 flex h-2">
                <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-primary-500 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-500"></span>
              </span>
              Built on Stellar with Soroban
            </div>

            {/* Main heading with clamp() for responsive font sizes */}
            <h1
              id="hero-heading"
              className="mx-auto mb-6 font-bold tracking-tight text-surface-900 dark:text-white"
              style={{
                fontSize: "clamp(2.5rem, 5vw + 1rem, 4.5rem)",
                lineHeight: "1.1",
              }}
            >
              The Future of{" "}
              <span className="bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent dark:from-primary-400 dark:to-primary-200">
                Content Subscriptions
              </span>
            </h1>

            {/* Subheading with clamp() for responsive font sizes */}
            <p
              className="mx-auto mb-10 max-w-2xl text-surface-600 dark:text-surface-300"
              style={{
                fontSize: "clamp(1rem, 2vw + 0.5rem, 1.25rem)",
                lineHeight: "1.6",
              }}
            >
              MyFans is a decentralized content subscription platform empowering
              creators to monetize their work directly. Connect your wallet to
              get started—no middleman, just you and your fans.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                variant="wallet"
                size="lg"
                onClick={handleGetStarted}
                className="min-w-[200px] shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-surface-900"
              >
                <span className="flex items-center gap-2">
                  Get Started
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </span>
              </Button>

              <Button
                variant="tertiary"
                size="lg"
                onClick={() => {
                  const creatorsSection = document.getElementById("creators");
                  creatorsSection?.scrollIntoView({ behavior: "smooth" });
                }}
                className="min-w-[200px]"
              >
                Explore Creators
              </Button>
            </div>

            {/* Trust indicators / Social proof */}
            <div className="mt-16 flex flex-col items-center gap-6">
              <p className="text-sm font-medium text-surface-500 dark:text-surface-400">
                Trusted by creators worldwide
              </p>
              <div className="flex items-center gap-8">
                {/* Placeholder stats - replace with actual data */}
                <div className="text-center">
                  <div
                    className="font-bold text-surface-900 dark:text-white"
                    style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)" }}
                  >
                    10K+
                  </div>
                  <div className="text-sm text-surface-500 dark:text-surface-400">
                    Creators
                  </div>
                </div>
                <div
                  className="h-12 w-px bg-surface-200 dark:bg-surface-700"
                  aria-hidden="true"
                />
                <div className="text-center">
                  <div
                    className="font-bold text-surface-900 dark:text-white"
                    style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)" }}
                  >
                    50K+
                  </div>
                  <div className="text-sm text-surface-500 dark:text-surface-400">
                    Subscribers
                  </div>
                </div>
                <div
                  className="h-12 w-px bg-surface-200 dark:bg-surface-700"
                  aria-hidden="true"
                />
                <div className="text-center">
                  <div
                    className="font-bold text-surface-900 dark:text-white"
                    style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)" }}
                  >
                    $1M+
                  </div>
                  <div className="text-sm text-surface-500 dark:text-surface-400">
                    Paid to Creators
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Hero image placeholder - reserved space to prevent CLS */}
          <div
            className="mt-16 aspect-video w-full overflow-hidden rounded-2xl bg-surface-100 dark:bg-surface-800"
            style={{ minHeight: "300px" }}
          >
            <div className="flex h-full items-center justify-center text-surface-400 dark:text-surface-500">
              <div className="text-center">
                <svg
                  className="mx-auto mb-4 h-16 w-16"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-sm">Hero illustration coming soon</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Wallet Selection Modal */}
      <WalletSelectionModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onConnect={handleWalletConnect}
      />
    </>
  );
}

export default Hero;
