export type OnboardingStep =
  | 'account-type'
  | 'profile'
  | 'social-links'
  | 'verification';

export type OnboardingIntent = 'creator' | 'fan' | 'both' | null;

/** Canonical step order for the onboarding flow. */
export const STEP_ORDER: OnboardingStep[] = [
  'account-type',
  'profile',
  'social-links',
  'verification',
];

/** True when every onboarding step has been either completed or skipped. */
export function isFlowFinished(
  completed: OnboardingStep[],
  skipped: OnboardingStep[],
): boolean {
  return STEP_ORDER.every(
    (step) => completed.includes(step) || skipped.includes(step),
  );
}
