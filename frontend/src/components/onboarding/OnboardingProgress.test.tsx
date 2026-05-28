import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { OnboardingProgress } from './OnboardingProgress';
import type { OnboardingStep } from '@/lib/onboarding-types';

const ALL_STEPS: OnboardingStep[] = [
  'account-type',
  'profile',
  'social-links',
  'verification',
];

describe('OnboardingProgress', () => {
  it('renders all four steps', () => {
    render(
      <OnboardingProgress
        currentStep="account-type"
        completedSteps={[]}
      />,
    );
    // Desktop labels (hidden on mobile via CSS, but still in DOM)
    expect(screen.getAllByText('Account Type').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Profile').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Social Links').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Verification').length).toBeGreaterThan(0);
  });

  it('shows progress bar with 0% when no steps done', () => {
    render(
      <OnboardingProgress
        currentStep="account-type"
        completedSteps={[]}
      />,
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '4');
  });

  it('reflects completed steps in progress bar', () => {
    render(
      <OnboardingProgress
        currentStep="profile"
        completedSteps={['account-type']}
      />,
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '1');
  });

  it('counts skipped steps toward progress', () => {
    render(
      <OnboardingProgress
        currentStep="verification"
        completedSteps={['account-type', 'profile']}
        skippedSteps={['social-links']}
      />,
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '3');
  });

  it('shows "X of 4 steps done" summary text', () => {
    render(
      <OnboardingProgress
        currentStep="social-links"
        completedSteps={['account-type', 'profile']}
      />,
    );
    expect(screen.getByText('2 of 4 steps done')).toBeInTheDocument();
  });

  it('uses creator-specific step labels when intent is creator', () => {
    render(
      <OnboardingProgress
        currentStep="account-type"
        completedSteps={[]}
        intent="creator"
      />,
    );
    expect(screen.getAllByText('Creator setup').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Public profile').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Wallet').length).toBeGreaterThan(0);
  });

  it('uses creator-specific labels when intent is both', () => {
    render(
      <OnboardingProgress
        currentStep="account-type"
        completedSteps={[]}
        intent="both"
      />,
    );
    expect(screen.getAllByText('Creator setup').length).toBeGreaterThan(0);
  });

  it('uses default labels when intent is fan', () => {
    render(
      <OnboardingProgress
        currentStep="account-type"
        completedSteps={[]}
        intent="fan"
      />,
    );
    expect(screen.getAllByText('Account Type').length).toBeGreaterThan(0);
  });

  it('shows skipped description for skipped steps', () => {
    render(
      <OnboardingProgress
        currentStep="verification"
        completedSteps={[]}
        skippedSteps={['account-type']}
      />,
    );
    expect(
      screen.getAllByText('Skipped — finish later in settings').length,
    ).toBeGreaterThan(0);
  });

  it('applies custom className', () => {
    const { container } = render(
      <OnboardingProgress
        currentStep="account-type"
        completedSteps={[]}
        className="my-custom-class"
      />,
    );
    expect(container.firstChild).toHaveClass('my-custom-class');
  });

  it('has accessible aria-label on progress bar', () => {
    render(
      <OnboardingProgress
        currentStep="account-type"
        completedSteps={[]}
      />,
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-label',
      'Onboarding progress',
    );
  });

  it('shows full progress when all steps completed', () => {
    render(
      <OnboardingProgress
        currentStep="verification"
        completedSteps={ALL_STEPS}
      />,
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '4');
    expect(screen.getByText('4 of 4 steps done')).toBeInTheDocument();
  });
});
