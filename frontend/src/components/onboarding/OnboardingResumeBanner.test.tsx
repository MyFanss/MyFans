import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OnboardingResumeBanner } from './OnboardingResumeBanner';
import * as hooks from '@/hooks';

vi.mock('@/hooks', () => ({
  useOnboarding: vi.fn(),
}));

const mockUseOnboarding = vi.mocked(hooks.useOnboarding);

function setOnboardingState(overrides: Partial<ReturnType<typeof hooks.useOnboarding>>) {
  mockUseOnboarding.mockReturnValue({
    isComplete: false,
    progressCount: 0,
    totalSteps: 4,
    onboardingIntent: null,
    currentStep: 'account-type',
    completedSteps: [],
    skippedSteps: [],
    canResume: false,
    savedAt: null,
    completeStep: vi.fn(),
    skipStep: vi.fn(),
    skipCurrentStep: vi.fn(),
    goToStep: vi.fn(),
    setOnboardingIntent: vi.fn(),
    resetOnboarding: vi.fn(),
    checkAndUpdateProgress: vi.fn(),
    ...overrides,
  } as ReturnType<typeof hooks.useOnboarding>);
}

describe('OnboardingResumeBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when onboarding is complete', () => {
    setOnboardingState({ isComplete: true, progressCount: 4 });
    const { container } = render(<OnboardingResumeBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no progress has been made', () => {
    setOnboardingState({ isComplete: false, progressCount: 0 });
    const { container } = render(<OnboardingResumeBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the banner when progress is partial', () => {
    setOnboardingState({ isComplete: false, progressCount: 2, totalSteps: 4 });
    render(<OnboardingResumeBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows generic copy for non-creator intent', () => {
    setOnboardingState({
      isComplete: false,
      progressCount: 1,
      totalSteps: 4,
      onboardingIntent: 'fan',
    });
    render(<OnboardingResumeBanner />);
    expect(
      screen.getByText('Finish setting up your account'),
    ).toBeInTheDocument();
  });

  it('shows creator-specific copy when intent is creator', () => {
    setOnboardingState({
      isComplete: false,
      progressCount: 1,
      totalSteps: 4,
      onboardingIntent: 'creator',
    });
    render(<OnboardingResumeBanner />);
    expect(screen.getByText('Finish your creator setup')).toBeInTheDocument();
  });

  it('shows creator-specific copy when intent is both', () => {
    setOnboardingState({
      isComplete: false,
      progressCount: 2,
      totalSteps: 4,
      onboardingIntent: 'both',
    });
    render(<OnboardingResumeBanner />);
    expect(screen.getByText('Finish your creator setup')).toBeInTheDocument();
  });

  it('shows step progress count in the banner', () => {
    setOnboardingState({
      isComplete: false,
      progressCount: 2,
      totalSteps: 4,
      onboardingIntent: null,
    });
    render(<OnboardingResumeBanner />);
    expect(screen.getByText(/2 of 4 steps done/)).toBeInTheDocument();
  });

  it('renders a Resume setup link pointing to /onboarding', () => {
    setOnboardingState({ isComplete: false, progressCount: 1, totalSteps: 4 });
    render(<OnboardingResumeBanner />);
    const link = screen.getByRole('link', { name: 'Resume setup' });
    expect(link).toHaveAttribute('href', '/onboarding');
  });
});
