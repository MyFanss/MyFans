'use client';

import type { OnboardingIntent, OnboardingStep } from '@/lib/onboarding-types';

export type { OnboardingStep };

export interface OnboardingStepConfig {
  id: OnboardingStep;
  label: string;
  description: string;
}

export interface OnboardingProgressProps {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  skippedSteps?: OnboardingStep[];
  /** When set to creator/both, step copy emphasizes creator setup. */
  intent?: OnboardingIntent;
  className?: string;
}

const DEFAULT_STEPS: OnboardingStepConfig[] = [
  {
    id: 'account-type',
    label: 'Account Type',
    description: 'Choose your role',
  },
  {
    id: 'profile',
    label: 'Profile',
    description: 'Set up your profile',
  },
  {
    id: 'social-links',
    label: 'Social Links',
    description: 'Connect your socials',
  },
  {
    id: 'verification',
    label: 'Verification',
    description: 'Verify your account',
  },
];

const CREATOR_STEPS: OnboardingStepConfig[] = [
  {
    id: 'account-type',
    label: 'Creator setup',
    description: 'Confirm you’re here to earn',
  },
  {
    id: 'profile',
    label: 'Public profile',
    description: 'Name, handle & bio fans will see',
  },
  {
    id: 'social-links',
    label: 'Discovery',
    description: 'Link out to your socials (optional)',
  },
  {
    id: 'verification',
    label: 'Wallet',
    description: 'Connect Stellar for payouts',
  },
];

function stepsForIntent(intent: OnboardingIntent): OnboardingStepConfig[] {
  if (intent === 'creator' || intent === 'both') {
    return CREATOR_STEPS;
  }
  return DEFAULT_STEPS;
}

export function OnboardingProgress({
  currentStep,
  completedSteps,
  skippedSteps = [],
  intent = null,
  className = '',
}: OnboardingProgressProps) {
  const ONBOARDING_STEPS = stepsForIntent(intent);

  const getStepStatus = (
    stepId: OnboardingStep,
  ): 'completed' | 'skipped' | 'current' | 'upcoming' => {
    if (completedSteps.includes(stepId)) return 'completed';
    if (skippedSteps.includes(stepId)) return 'skipped';
    if (stepId === currentStep) return 'current';
    return 'upcoming';
  };

  const doneCount = completedSteps.length + skippedSteps.length;

  return (
    <div className={`w-full ${className}`}>
      {/* Mobile: Vertical Progress */}
      <div className="sm:hidden space-y-4">
        {ONBOARDING_STEPS.map((step, index) => {
          const status = getStepStatus(step.id);
          const isCompleted = status === 'completed';
          const isSkipped = status === 'skipped';
          const isCurrent = status === 'current';

          return (
            <div key={step.id} className="flex items-start gap-3">
              {/* Step Indicator */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all
                    ${
                      isCompleted
                        ? 'border-green-500 bg-green-500 text-white'
                        : isSkipped
                        ? 'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-500 dark:bg-amber-900/40 dark:text-amber-100'
                        : isCurrent
                        ? 'border-purple-500 bg-purple-500 text-white'
                        : 'border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-800'
                    }
                  `}
                  aria-label={`Step ${index + 1}: ${step.label}`}
                >
                  {isCompleted ? (
                    <svg 
                      className="h-5 w-5" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M5 13l4 4L19 7" 
                      />
                    </svg>
                  ) : isSkipped ? (
                    <span className="text-xs font-bold" title="Skipped">
                      —
                    </span>
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </div>
                {index < ONBOARDING_STEPS.length - 1 && (
                  <div
                    className={`
                      mt-2 h-12 w-0.5 transition-colors
                      ${
                        isCompleted || isSkipped
                          ? 'bg-green-500'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }
                    `}
                  />
                )}
              </div>

              {/* Step Content */}
              <div className="flex-1 pt-1">
                <h3
                  className={`
                    text-sm font-semibold transition-colors
                    ${
                      isCurrent
                        ? 'text-purple-600 dark:text-purple-400'
                        : isCompleted || isSkipped
                        ? 'text-gray-900 dark:text-gray-100'
                        : 'text-gray-500 dark:text-gray-400'
                    }
                  `}
                >
                  {step.label}
                </h3>
                <p
                  className={`
                    text-xs transition-colors
                    ${
                      isCurrent || isCompleted || isSkipped
                        ? 'text-gray-600 dark:text-gray-300'
                        : 'text-gray-400 dark:text-gray-500'
                    }
                  `}
                >
                  {isSkipped ? 'Skipped — finish later in settings' : step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: Horizontal Progress */}
      <div className="hidden sm:block">
        <div className="flex items-center justify-between">
          {ONBOARDING_STEPS.map((step, index) => {
            const status = getStepStatus(step.id);
            const isCompleted = status === 'completed';
            const isSkipped = status === 'skipped';
            const isCurrent = status === 'current';
            const isLast = index === ONBOARDING_STEPS.length - 1;

            return (
              <div key={step.id} className="flex flex-1 items-center">
                {/* Step */}
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all
                      ${
                        isCompleted
                          ? 'border-green-500 bg-green-500 text-white'
                          : isSkipped
                          ? 'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-500 dark:bg-amber-900/40 dark:text-amber-100'
                          : isCurrent
                          ? 'border-purple-500 bg-purple-500 text-white ring-4 ring-purple-100 dark:ring-purple-900/30'
                          : 'border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-800'
                      }
                    `}
                    aria-label={`Step ${index + 1}: ${step.label}`}
                  >
                    {isCompleted ? (
                      <svg 
                        className="h-6 w-6" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M5 13l4 4L19 7" 
                        />
                      </svg>
                    ) : isSkipped ? (
                      <span className="text-sm font-bold">—</span>
                    ) : (
                      <span className="text-base font-semibold">{index + 1}</span>
                    )}
                  </div>
                  <div className="mt-3 text-center">
                    <h3
                      className={`
                        text-sm font-semibold transition-colors
                        ${
                          isCurrent
                            ? 'text-purple-600 dark:text-purple-400'
                            : isCompleted || isSkipped
                            ? 'text-gray-900 dark:text-gray-100'
                            : 'text-gray-500 dark:text-gray-400'
                        }
                      `}
                    >
                      {step.label}
                    </h3>
                    <p
                      className={`
                        mt-1 text-xs transition-colors
                        ${
                          isCurrent || isCompleted || isSkipped
                            ? 'text-gray-600 dark:text-gray-300'
                            : 'text-gray-400 dark:text-gray-500'
                        }
                      `}
                    >
                      {isSkipped ? 'Skipped' : step.description}
                    </p>
                  </div>
                </div>

                {/* Connector Line */}
                {!isLast && (
                  <div className="flex-1 px-4 pb-8">
                    <div
                      className={`
                        h-0.5 w-full transition-colors
                        ${
                          isCompleted || isSkipped
                            ? 'bg-green-500'
                            : 'bg-gray-300 dark:bg-gray-600'
                        }
                      `}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-6">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-2">
          <span>Progress</span>
          <span className="font-semibold">
            {doneCount} of {ONBOARDING_STEPS.length} steps done
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-green-500 transition-all duration-500 ease-out"
            style={{
              width: `${(doneCount / ONBOARDING_STEPS.length) * 100}%`,
            }}
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={ONBOARDING_STEPS.length}
            aria-label="Onboarding progress"
          />
        </div>
      </div>
    </div>
  );
}
