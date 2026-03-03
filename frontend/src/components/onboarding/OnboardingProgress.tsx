'use client';

export type OnboardingStep = 
  | 'account-type'
  | 'profile'
  | 'social-links'
  | 'verification';

export interface OnboardingStepConfig {
  id: OnboardingStep;
  label: string;
  description: string;
}

export interface OnboardingProgressProps {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  className?: string;
}

const ONBOARDING_STEPS: OnboardingStepConfig[] = [
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

export function OnboardingProgress({
  currentStep,
  completedSteps,
  className = '',
}: OnboardingProgressProps) {
  const currentStepIndex = ONBOARDING_STEPS.findIndex(
    (step) => step.id === currentStep
  );

  const getStepStatus = (stepId: OnboardingStep): 'completed' | 'current' | 'upcoming' => {
    if (completedSteps.includes(stepId)) return 'completed';
    if (stepId === currentStep) return 'current';
    return 'upcoming';
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Mobile: Vertical Progress */}
      <div className="sm:hidden space-y-4">
        {ONBOARDING_STEPS.map((step, index) => {
          const status = getStepStatus(step.id);
          const isCompleted = status === 'completed';
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
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </div>
                {index < ONBOARDING_STEPS.length - 1 && (
                  <div
                    className={`
                      mt-2 h-12 w-0.5 transition-colors
                      ${
                        isCompleted
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
                        : isCompleted
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
                      isCurrent || isCompleted
                        ? 'text-gray-600 dark:text-gray-300'
                        : 'text-gray-400 dark:text-gray-500'
                    }
                  `}
                >
                  {step.description}
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
                            : isCompleted
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
                          isCurrent || isCompleted
                            ? 'text-gray-600 dark:text-gray-300'
                            : 'text-gray-400 dark:text-gray-500'
                        }
                      `}
                    >
                      {step.description}
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
                          isCompleted
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
            {completedSteps.length} of {ONBOARDING_STEPS.length} completed
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-green-500 transition-all duration-500 ease-out"
            style={{
              width: `${(completedSteps.length / ONBOARDING_STEPS.length) * 100}%`,
            }}
            role="progressbar"
            aria-valuenow={completedSteps.length}
            aria-valuemin={0}
            aria-valuemax={ONBOARDING_STEPS.length}
            aria-label="Onboarding progress"
          />
        </div>
      </div>
    </div>
  );
}
