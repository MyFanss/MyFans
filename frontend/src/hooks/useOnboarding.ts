'use client';

import { useState, useEffect, useCallback } from 'react';
import type { OnboardingIntent, OnboardingStep } from '@/lib/onboarding-types';

export const ONBOARDING_STORAGE_KEY = 'myfans_onboarding_state';
export const ONBOARDING_PROFILE_DRAFT_KEY = 'myfans_onboarding_profile_draft';

/** Saved state older than this is considered stale and reset to a fresh start. */
export const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type { OnboardingIntent };

export interface OnboardingState {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  skippedSteps: OnboardingStep[];
  isComplete: boolean;
  onboardingIntent: OnboardingIntent;
  savedAt: string | null;
}

interface OnboardingData {
  accountType?: 'creator' | 'fan' | 'both';
  profileComplete?: boolean;
  socialLinksComplete?: boolean;
  verificationComplete?: boolean;
}

export const STEP_ORDER: OnboardingStep[] = [
  'account-type',
  'profile',
  'social-links',
  'verification',
];

/** Exported for tests — true when every step is completed or skipped. */
export function isFlowFinished(
  completed: OnboardingStep[],
  skipped: OnboardingStep[],
): boolean {
  return STEP_ORDER.every(
    (s) => completed.includes(s) || skipped.includes(s),
  );
}

function nextCurrentStep(
  prevStep: OnboardingStep,
  handledStep: OnboardingStep,
): OnboardingStep {
  const handledIdx = STEP_ORDER.indexOf(handledStep);
  const prevIdx = STEP_ORDER.indexOf(prevStep);
  if (handledIdx !== prevIdx) {
    return prevStep;
  }
  const ni = prevIdx + 1;
  if (ni < STEP_ORDER.length) {
    return STEP_ORDER[ni];
  }
  return prevStep;
}

const FRESH_STATE: OnboardingState = {
  currentStep: 'account-type',
  completedSteps: [],
  skippedSteps: [],
  isComplete: false,
  onboardingIntent: null,
  savedAt: null,
};

function isValidStep(value: unknown): value is OnboardingStep {
  return typeof value === 'string' && (STEP_ORDER as string[]).includes(value);
}

function isValidIntent(value: unknown): value is OnboardingIntent {
  return value === null || value === 'creator' || value === 'fan' || value === 'both';
}

function parseStoredState(raw: string | null): OnboardingState {
  if (!raw) return { ...FRESH_STATE };
  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;

    // Reject stale state — savedAt older than threshold resets to fresh
    if (parsed.savedAt) {
      const age = Date.now() - new Date(parsed.savedAt).getTime();
      if (!isFinite(age) || age > STALE_THRESHOLD_MS) {
        return { ...FRESH_STATE };
      }
    }

    // Sanitize arrays — filter out any unrecognised step values
    const completedSteps = (parsed.completedSteps ?? []).filter(isValidStep);
    const skippedSteps = (parsed.skippedSteps ?? []).filter(isValidStep);

    const rawStep = parsed.currentStep;
    const currentStep = isValidStep(rawStep) ? rawStep : 'account-type';

    const onboardingIntent = isValidIntent(parsed.onboardingIntent)
      ? parsed.onboardingIntent
      : null;

    const isComplete =
      parsed.isComplete === true ||
      isFlowFinished(completedSteps, skippedSteps);

    return {
      currentStep,
      completedSteps,
      skippedSteps,
      isComplete,
      onboardingIntent,
      savedAt: parsed.savedAt ?? null,
    };
  } catch {
    return { ...FRESH_STATE };
  }
}

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(() => {
    if (typeof window === 'undefined') {
      return parseStoredState(null);
    }
    return parseStoredState(localStorage.getItem(ONBOARDING_STORAGE_KEY));
  });

  useEffect(() => {
    const next: OnboardingState = {
      ...state,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(next));
  }, [state]);

  const completeStep = useCallback((step: OnboardingStep) => {
    setState((prev) => {
      if (prev.completedSteps.includes(step)) {
        return prev;
      }
      const completedSteps = [...prev.completedSteps, step];
      const currentStep = nextCurrentStep(prev.currentStep, step);
      const isComplete = isFlowFinished(completedSteps, prev.skippedSteps);
      return {
        ...prev,
        completedSteps,
        currentStep,
        isComplete,
      };
    });
  }, []);

  const skipStep = useCallback((step: OnboardingStep) => {
    setState((prev) => {
      if (prev.skippedSteps.includes(step) || prev.completedSteps.includes(step)) {
        return prev;
      }
      const skippedSteps = [...prev.skippedSteps, step];
      const currentStep = nextCurrentStep(prev.currentStep, step);
      const isComplete = isFlowFinished(prev.completedSteps, skippedSteps);
      return {
        ...prev,
        skippedSteps,
        currentStep,
        isComplete,
      };
    });
  }, []);

  const skipCurrentStep = useCallback(() => {
    setState((prev) => {
      const step = prev.currentStep;
      if (prev.skippedSteps.includes(step) || prev.completedSteps.includes(step)) {
        return prev;
      }
      const skippedSteps = [...prev.skippedSteps, step];
      const curIdx = STEP_ORDER.indexOf(step);
      const ni = curIdx + 1;
      const currentStep =
        ni < STEP_ORDER.length ? STEP_ORDER[ni] : step;
      const isComplete = isFlowFinished(prev.completedSteps, skippedSteps);
      return {
        ...prev,
        skippedSteps,
        currentStep,
        isComplete,
      };
    });
  }, []);

  const goToStep = useCallback((step: OnboardingStep) => {
    setState((prev) => ({
      ...prev,
      currentStep: step,
    }));
  }, []);

  const setOnboardingIntent = useCallback((intent: OnboardingIntent) => {
    setState((prev) => ({ ...prev, onboardingIntent: intent }));
  }, []);

  const resetOnboarding = useCallback(() => {
    const empty = parseStoredState(null);
    setState(empty);
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    localStorage.removeItem(ONBOARDING_PROFILE_DRAFT_KEY);
  }, []);

  const checkAndUpdateProgress = useCallback(
    (data: OnboardingData) => {
      const stepsToComplete: OnboardingStep[] = [];

      if (data.accountType) {
        stepsToComplete.push('account-type');
      }
      if (data.profileComplete) {
        stepsToComplete.push('profile');
      }
      if (data.socialLinksComplete) {
        stepsToComplete.push('social-links');
      }
      if (data.verificationComplete) {
        stepsToComplete.push('verification');
      }

      stepsToComplete.forEach((step) => completeStep(step));
    },
    [completeStep],
  );

  const progressCount =
    state.completedSteps.length + state.skippedSteps.length;
  const canResume =
    !state.isComplete &&
    progressCount > 0 &&
    progressCount < STEP_ORDER.length;

  return {
    ...state,
    completeStep,
    skipStep,
    skipCurrentStep,
    goToStep,
    setOnboardingIntent,
    resetOnboarding,
    checkAndUpdateProgress,
    progressCount,
    canResume,
    totalSteps: STEP_ORDER.length,
  };
}
