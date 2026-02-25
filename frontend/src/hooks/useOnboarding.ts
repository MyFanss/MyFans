'use client';

import { useState, useEffect, useCallback } from 'react';
import type { OnboardingStep } from '@/components/onboarding';

const ONBOARDING_STORAGE_KEY = 'myfans_onboarding_state';

export interface OnboardingState {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  isComplete: boolean;
}

interface OnboardingData {
  accountType?: 'creator' | 'fan' | 'both';
  profileComplete?: boolean;
  socialLinksComplete?: boolean;
  verificationComplete?: boolean;
}

const STEP_ORDER: OnboardingStep[] = [
  'account-type',
  'profile',
  'social-links',
  'verification',
];

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(() => {
    if (typeof window === 'undefined') {
      return {
        currentStep: 'account-type',
        completedSteps: [],
        isComplete: false,
      };
    }

    const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!stored) {
      return {
        currentStep: 'account-type',
        completedSteps: [],
        isComplete: false,
      };
    }

    try {
      return JSON.parse(stored) as OnboardingState;
    } catch (error) {
      console.error('Failed to parse onboarding state:', error);
      return {
        currentStep: 'account-type',
        completedSteps: [],
        isComplete: false,
      };
    }
  });

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const completeStep = useCallback((step: OnboardingStep) => {
    setState((prev) => {
      // Don't add if already completed
      if (prev.completedSteps.includes(step)) {
        return prev;
      }

      const newCompletedSteps = [...prev.completedSteps, step];
      const currentStepIndex = STEP_ORDER.indexOf(prev.currentStep);
      const completedStepIndex = STEP_ORDER.indexOf(step);

      // Move to next step if we completed the current step
      let nextStep = prev.currentStep;
      if (completedStepIndex === currentStepIndex) {
        const nextStepIndex = currentStepIndex + 1;
        if (nextStepIndex < STEP_ORDER.length) {
          nextStep = STEP_ORDER[nextStepIndex];
        }
      }

      const isComplete = newCompletedSteps.length === STEP_ORDER.length;

      return {
        currentStep: nextStep,
        completedSteps: newCompletedSteps,
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

  const resetOnboarding = useCallback(() => {
    setState({
      currentStep: 'account-type',
      completedSteps: [],
      isComplete: false,
    });
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  }, []);

  // Check if data is saved to mark steps as complete
  const checkAndUpdateProgress = useCallback((data: OnboardingData) => {
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
  }, [completeStep]);

  return {
    ...state,
    completeStep,
    goToStep,
    resetOnboarding,
    checkAndUpdateProgress,
  };
}
