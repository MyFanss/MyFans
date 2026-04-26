"use client";

import { useEffect, useRef, useState } from "react";
import { OnboardingProgress } from "@/components/onboarding";
import {
  useOnboarding,
  ONBOARDING_PROFILE_DRAFT_KEY,
} from "@/hooks/useOnboarding";
import { useToast } from "@/contexts/ToastContext";
import AccountType from "@/components/AccountType";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { SocialLinksForm } from "@/components/settings/social-links-form";

export default function OnboardingPage() {
  const { showSuccess, showInfo } = useToast();
  const {
    currentStep,
    completedSteps,
    skippedSteps,
    isComplete,
    onboardingIntent,
    completeStep,
    skipCurrentStep,
    goToStep,
    setOnboardingIntent,
    resetOnboarding,
    canResume,
  } = useOnboarding();

  const [accountType, setAccountType] = useState<
    "creator" | "fan" | "both" | null
  >(null);
  const [profileData, setProfileData] = useState({
    displayName: '',
    username: '',
    bio: '',
  });
  const [profileErrors, setProfileErrors] = useState({
    displayName: '',
    username: '',
  });
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const completionHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ONBOARDING_PROFILE_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as typeof profileData;
        setProfileData((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (onboardingIntent) {
      setAccountType(onboardingIntent);
    }
  }, [onboardingIntent]);

  useEffect(() => {
    localStorage.setItem(
      ONBOARDING_PROFILE_DRAFT_KEY,
      JSON.stringify(profileData),
    );
  }, [profileData]);

  useEffect(() => {
    if (!isComplete) {
      stepHeadingRef.current?.focus();
    }
  }, [currentStep, isComplete]);

  useEffect(() => {
    if (isComplete) {
      completionHeadingRef.current?.focus();
    }
  }, [isComplete]);

  const handleAccountTypeSelect = (type: "creator" | "fan" | "both") => {
    setAccountType(type);
    setOnboardingIntent(type);
  };

  const handleAccountTypeContinue = () => {
    if (accountType) {
      completeStep("account-type");
      showSuccess(
        "Account type selected",
        `You are joining as a ${accountType}.`,
      );
    }
  };

  const handleProfileSave = () => {
    const nextErrors = {
      displayName: profileData.displayName.trim() ? '' : 'Display name is required',
      username: profileData.username.trim() ? '' : 'Username is required',
    };
    setProfileErrors(nextErrors);
    if (nextErrors.displayName || nextErrors.username) return;
    completeStep("profile");
    showSuccess(
      "Profile updated",
      "Your display name and username have been set.",
    );
  };

  const handleProfileSkip = () => {
    skipCurrentStep();
    showInfo(
      "Skipped for now",
      "You can finish your profile anytime in Settings.",
    );
  };

  const handleSocialLinksSubmit = () => {
    completeStep("social-links");
    showInfo(
      "Social links saved",
      "You can always update these later in settings.",
    );
  };

  const handleSocialSkip = () => {
    skipCurrentStep();
    showInfo(
      "Skipped",
      "Add social links later under Settings → Profile & social.",
    );
  };

  const handleVerificationComplete = () => {
    completeStep("verification");
    showSuccess(
      "Wallet verified",
      "Your account is now securely linked to your Stellar wallet.",
    );
  };

  const handleVerificationSkip = () => {
    skipCurrentStep();
    showInfo(
      "Wallet later",
      "Connect your wallet from Settings or the wallet page when you are ready.",
    );
  };

  const isCreatorCopy =
    onboardingIntent === "creator" || onboardingIntent === "both";

  const renderStepContent = () => {
    switch (currentStep) {
      case "account-type":
        return (
          <div className="space-y-6">
            <div>
              <h2
                ref={stepHeadingRef}
                tabIndex={-1}
                className="text-2xl font-bold text-gray-900 focus-visible:outline-none dark:text-white"
              >
                Choose Your Account Type
              </h2>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Select how you want to use MyFans — you can change this later.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => handleAccountTypeSelect("creator")}
                className={`
                  rounded-2xl border-2 p-6 text-left transition-all
                  ${
                    accountType === "creator"
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                      : "border-gray-200 bg-white hover:border-purple-300 dark:border-gray-700 dark:bg-gray-800"
                  }
                `}
              >
                <div className="mb-3 text-3xl">✨</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Creator
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Create content and earn from subscriptions
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleAccountTypeSelect("fan")}
                className={`
                  rounded-2xl border-2 p-6 text-left transition-all
                  ${
                    accountType === "fan"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 bg-white hover:border-blue-300 dark:border-gray-700 dark:bg-gray-800"
                  }
                `}
              >
                <div className="mb-3 text-3xl">💙</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Fan
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Subscribe to creators and access exclusive content
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleAccountTypeSelect("both")}
                className={`
                  rounded-2xl border-2 p-6 text-left transition-all
                  ${
                    accountType === "both"
                      ? "border-purple-500 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20"
                      : "border-gray-200 bg-white hover:border-purple-300 dark:border-gray-700 dark:bg-gray-800"
                  }
                `}
              >
                <div className="mb-3 text-3xl">⭐</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Both
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Create content and subscribe to other creators
                </p>
              </button>
            </div>

            {accountType && (
              <div className="pt-4">
                <AccountType status={accountType} />
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAccountTypeContinue}
                disabled={!accountType}
                className="rounded-lg bg-purple-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        );

      case "profile":
        return (
          <div className="space-y-6">
            <div>
              <h2
                ref={stepHeadingRef}
                tabIndex={-1}
                className="text-2xl font-bold text-gray-900 focus-visible:outline-none dark:text-white"
              >
                {isCreatorCopy
                  ? "Build your creator profile"
                  : "Set Up Your Profile"}
              </h2>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                {isCreatorCopy
                  ? "Fans see this on your page — you can refine it anytime."
                  : "Tell us about yourself"}
              </p>
            </div>

            <div className="space-y-4">
              <Input
                label="Display Name"
                value={profileData.displayName}
                onChange={(e) =>
                  setProfileData({ ...profileData, displayName: e.target.value })
                }
                placeholder="Your display name"
                error={profileErrors.displayName || undefined}
              />

              <Input
                label="Username"
                value={profileData.username}
                onChange={(e) =>
                  setProfileData({ ...profileData, username: e.target.value })
                }
                placeholder="@username"
                error={profileErrors.username || undefined}
              />

              <Textarea
                label="Bio"
                value={profileData.bio}
                onChange={(e) =>
                  setProfileData({ ...profileData, bio: e.target.value })
                }
                placeholder="Tell us about yourself..."
                rows={4}
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => goToStep("account-type")}
                className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Back
              </button>
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <button
                  type="button"
                  onClick={handleProfileSkip}
                  className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Skip for now
                </button>
                <button
                  type="button"
                  onClick={handleProfileSave}
                  className="rounded-lg bg-purple-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save & continue
                </button>
              </div>
            </div>
          </div>
        );

      case "social-links":
        return (
          <div className="space-y-6">
            <div>
              <h2
                ref={stepHeadingRef}
                tabIndex={-1}
                className="text-2xl font-bold text-gray-900 focus-visible:outline-none dark:text-white"
              >
                {isCreatorCopy
                  ? "Help fans find you"
                  : "Connect Your Social Links"}
              </h2>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Optional — add links so people can follow you elsewhere.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <SocialLinksForm onSubmit={handleSocialLinksSubmit} />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => goToStep("profile")}
                className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSocialSkip}
                className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Skip for now
              </button>
            </div>
          </div>
        );

      case "verification":
        return (
          <div className="space-y-6">
            <div>
              <h2
                ref={stepHeadingRef}
                tabIndex={-1}
                className="text-2xl font-bold text-gray-900 focus-visible:outline-none dark:text-white"
              >
                {isCreatorCopy ? "Connect your wallet" : "Verify Your Account"}
              </h2>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                {isCreatorCopy
                  ? "Required for payouts — you can do this later if you prefer."
                  : "Connect your wallet to complete setup"}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                <svg
                  className="h-8 w-8 text-purple-600 dark:text-purple-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Wallet verification
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Connect your Stellar wallet to verify your identity and enable
                transactions
              </p>
              <button
                type="button"
                onClick={handleVerificationComplete}
                className="mt-6 rounded-lg bg-purple-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-600"
              >
                Connect Wallet
              </button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => goToStep("social-links")}
                className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleVerificationSkip}
                className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                I&apos;ll do this later
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (isComplete) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <svg
                className="h-10 w-10 text-green-600 dark:text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1
              ref={completionHeadingRef}
              tabIndex={-1}
              className="text-3xl font-bold text-gray-900 focus-visible:outline-none dark:text-white"
            >
              {isCreatorCopy
                ? "You’re ready to create"
                : "Welcome to MyFans!"}
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {isCreatorCopy
                ? "Your creator setup is wrapped up. Head to the dashboard to publish and manage subscribers."
                : "Your account is all set up and ready to go"}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/dashboard";
                }}
                className="rounded-lg bg-purple-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-600"
              >
                Go to Dashboard
              </button>
              <button
                type="button"
                onClick={resetOnboarding}
                className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Reset demo
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {isCreatorCopy ? "Creator onboarding" : "Welcome to MyFans"}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {canResume
              ? "Welcome back — pick up where you left off. Skipped steps can be finished in Settings."
              : "A few quick steps — skip any step and resume later."}
          </p>
        </div>

        <div className="mb-8">
          <OnboardingProgress
            currentStep={currentStep}
            completedSteps={completedSteps}
            skippedSteps={skippedSteps}
            intent={onboardingIntent}
          />
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 dark:border-gray-700 dark:bg-gray-800">
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
}
