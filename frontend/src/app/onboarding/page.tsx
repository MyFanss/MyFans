'use client';

import { useEffect, useRef, useState } from 'react';
import { OnboardingProgress, type OnboardingStep } from '@/components/onboarding';
import { useOnboarding } from '@/hooks';
import AccountType from '@/components/AccountType';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { SocialLinksForm } from '@/components/settings/social-links-form';

export default function OnboardingPage() {
  const {
    currentStep,
    completedSteps,
    isComplete,
    completeStep,
    goToStep,
    resetOnboarding,
  } = useOnboarding();

  const [accountType, setAccountType] = useState<'creator' | 'fan' | 'both' | null>(null);
  const [profileData, setProfileData] = useState({
    displayName: '',
    username: '',
    bio: '',
  });
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const completionHeadingRef = useRef<HTMLHeadingElement>(null);

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

  const handleAccountTypeSelect = (type: 'creator' | 'fan' | 'both') => {
    setAccountType(type);
  };

  const handleAccountTypeContinue = () => {
    if (accountType) {
      completeStep('account-type');
    }
  };

  const handleProfileSave = () => {
    if (profileData.displayName && profileData.username) {
      completeStep('profile');
    }
  };

  const handleSocialLinksSave = () => {
    completeStep('social-links');
  };

  const handleVerificationComplete = () => {
    completeStep('verification');
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'account-type':
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
                Select how you want to use MyFans
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <button
                onClick={() => handleAccountTypeSelect('creator')}
                className={`
                  rounded-2xl border-2 p-6 text-left transition-all
                  ${
                    accountType === 'creator'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 bg-white hover:border-purple-300 dark:border-gray-700 dark:bg-gray-800'
                  }
                `}
              >
                <div className="text-3xl mb-3">✨</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Creator
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Create content and earn from subscriptions
                </p>
              </button>

              <button
                onClick={() => handleAccountTypeSelect('fan')}
                className={`
                  rounded-2xl border-2 p-6 text-left transition-all
                  ${
                    accountType === 'fan'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 bg-white hover:border-blue-300 dark:border-gray-700 dark:bg-gray-800'
                  }
                `}
              >
                <div className="text-3xl mb-3">💙</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Fan
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Subscribe to creators and access exclusive content
                </p>
              </button>

              <button
                onClick={() => handleAccountTypeSelect('both')}
                className={`
                  rounded-2xl border-2 p-6 text-left transition-all
                  ${
                    accountType === 'both'
                      ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20'
                      : 'border-gray-200 bg-white hover:border-purple-300 dark:border-gray-700 dark:bg-gray-800'
                  }
                `}
              >
                <div className="text-3xl mb-3">⭐</div>
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
                onClick={handleAccountTypeContinue}
                disabled={!accountType}
                className="rounded-lg bg-purple-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        );

      case 'profile':
        return (
          <div className="space-y-6">
            <div>
              <h2
                ref={stepHeadingRef}
                tabIndex={-1}
                className="text-2xl font-bold text-gray-900 focus-visible:outline-none dark:text-white"
              >
                Set Up Your Profile
              </h2>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Tell us about yourself
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
              />

              <Input
                label="Username"
                value={profileData.username}
                onChange={(e) =>
                  setProfileData({ ...profileData, username: e.target.value })
                }
                placeholder="@username"
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

            <div className="flex justify-between">
              <button
                onClick={() => goToStep('account-type')}
                className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Back
              </button>
              <button
                onClick={handleProfileSave}
                disabled={!profileData.displayName || !profileData.username}
                className="rounded-lg bg-purple-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        );

      case 'social-links':
        return (
          <div className="space-y-6">
            <div>
              <h2
                ref={stepHeadingRef}
                tabIndex={-1}
                className="text-2xl font-bold text-gray-900 focus-visible:outline-none dark:text-white"
              >
                Connect Your Social Links
              </h2>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Help fans find you on other platforms (optional)
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <SocialLinksForm onSubmit={handleSocialLinksSave} />
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => goToStep('profile')}
                className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Back
              </button>
              <button
                onClick={handleSocialLinksSave}
                className="rounded-lg bg-purple-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-600"
              >
                Continue
              </button>
            </div>
          </div>
        );

      case 'verification':
        return (
          <div className="space-y-6">
            <div>
              <h2
                ref={stepHeadingRef}
                tabIndex={-1}
                className="text-2xl font-bold text-gray-900 focus-visible:outline-none dark:text-white"
              >
                Verify Your Account
              </h2>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Connect your wallet to complete setup
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
                Wallet Verification
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Connect your Stellar wallet to verify your identity and enable transactions
              </p>
              <button
                onClick={handleVerificationComplete}
                className="mt-6 rounded-lg bg-purple-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-600"
              >
                Connect Wallet
              </button>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => goToStep('social-links')}
                className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Back
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
              Welcome to MyFans!
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Your account is all set up and ready to go
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <button
                onClick={() => (window.location.href = '/dashboard')}
                className="rounded-lg bg-purple-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-600"
              >
                Go to Dashboard
              </button>
              <button
                onClick={resetOnboarding}
                className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Reset Demo
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
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome to MyFans
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Let's get your account set up
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <OnboardingProgress
            currentStep={currentStep}
            completedSteps={completedSteps}
          />
        </div>

        {/* Step Content */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 dark:border-gray-700 dark:bg-gray-800">
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
}
