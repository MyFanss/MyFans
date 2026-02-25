# Onboarding Progress Integration Guide

This guide shows how to integrate the onboarding progress indicator into your existing pages.

## Quick Start

Visit `/onboarding` to see the full interactive demo.

## Integration Steps

### 1. Add Progress Indicator to Profile Page

```tsx
// frontend/src/app/profile/page.tsx
'use client';

import { OnboardingProgress } from '@/components/onboarding';
import { useOnboarding } from '@/hooks';

export default function ProfilePage() {
  const { currentStep, completedSteps, completeStep, isComplete } = useOnboarding();

  // Show progress only if onboarding is not complete
  const showOnboarding = !isComplete;

  const handleSaveProfile = async () => {
    // ... your save logic
    
    // Mark profile step as complete
    completeStep('profile');
  };

  return (
    <div>
      {showOnboarding && (
        <div className="mb-8">
          <OnboardingProgress
            currentStep={currentStep}
            completedSteps={completedSteps}
          />
        </div>
      )}
      
      {/* Your existing profile form */}
    </div>
  );
}
```

### 2. Add Progress Indicator to Settings Page

```tsx
// frontend/src/app/settings/page.tsx
'use client';

import { OnboardingProgress } from '@/components/onboarding';
import { useOnboarding } from '@/hooks';

export default function SettingsPage() {
  const { currentStep, completedSteps, completeStep, isComplete } = useOnboarding();

  const handleSocialLinksSave = async (links) => {
    // ... your save logic
    
    // Mark social links step as complete
    completeStep('social-links');
  };

  return (
    <div>
      {!isComplete && (
        <div className="mb-8">
          <OnboardingProgress
            currentStep={currentStep}
            completedSteps={completedSteps}
          />
        </div>
      )}
      
      {/* Your existing settings content */}
    </div>
  );
}
```

### 3. Track Account Type Selection

```tsx
// When user selects account type
const handleAccountTypeSelect = (type: 'creator' | 'fan' | 'both') => {
  setAccountType(type);
  
  // Save to backend
  await api.saveAccountType(type);
  
  // Mark step as complete
  completeStep('account-type');
};
```

### 4. Track Wallet Verification

```tsx
// When wallet is connected
const handleWalletConnect = async (address: string) => {
  // ... your wallet connection logic
  
  // Mark verification step as complete
  completeStep('verification');
};
```

## Route-Based Progress Tracking

You can automatically set the current step based on the route:

```tsx
// frontend/src/app/layout.tsx or a wrapper component
'use client';

import { usePathname } from 'next/navigation';
import { useOnboarding } from '@/hooks';
import { useEffect } from 'react';

export function OnboardingWrapper({ children }) {
  const pathname = usePathname();
  const { goToStep, isComplete } = useOnboarding();

  useEffect(() => {
    if (isComplete) return;

    // Map routes to steps
    const routeStepMap = {
      '/profile': 'profile',
      '/settings': 'social-links',
      '/wallet': 'verification',
    };

    const step = routeStepMap[pathname];
    if (step) {
      goToStep(step);
    }
  }, [pathname, goToStep, isComplete]);

  return <>{children}</>;
}
```

## Backend Integration

### Sync Progress on Page Load

```tsx
useEffect(() => {
  const loadUserData = async () => {
    const user = await api.getUser();
    
    // Update progress based on saved data
    checkAndUpdateProgress({
      accountType: user.accountType,
      profileComplete: user.displayName && user.username,
      socialLinksComplete: user.socialLinks?.length > 0,
      verificationComplete: user.walletAddress !== null,
    });
  };

  loadUserData();
}, [checkAndUpdateProgress]);
```

### Save Progress to Backend

```tsx
const { completedSteps } = useOnboarding();

useEffect(() => {
  // Save progress to backend whenever it changes
  api.saveOnboardingProgress({
    completedSteps,
    lastUpdated: new Date().toISOString(),
  });
}, [completedSteps]);
```

## Conditional Rendering

### Show Different Content Based on Progress

```tsx
const { currentStep, isComplete } = useOnboarding();

if (!isComplete && currentStep === 'account-type') {
  return <AccountTypeSelection />;
}

if (!isComplete && currentStep === 'profile') {
  return <ProfileSetup />;
}

// Show normal content if onboarding is complete
return <Dashboard />;
```

### Redirect to Onboarding

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboarding } from '@/hooks';

export function OnboardingGuard({ children }) {
  const router = useRouter();
  const { isComplete } = useOnboarding();

  useEffect(() => {
    if (!isComplete) {
      router.push('/onboarding');
    }
  }, [isComplete, router]);

  if (!isComplete) {
    return null; // or a loading spinner
  }

  return <>{children}</>;
}
```

## Styling Customization

### Custom Colors

```tsx
// Modify the component or use CSS variables
<OnboardingProgress
  currentStep={currentStep}
  completedSteps={completedSteps}
  className="custom-progress"
/>
```

```css
/* In your CSS */
.custom-progress {
  --progress-completed: #10b981; /* green */
  --progress-current: #8b5cf6;   /* purple */
  --progress-upcoming: #d1d5db;  /* gray */
}
```

## Testing

### Reset Progress for Testing

```tsx
import { useOnboarding } from '@/hooks';

function DevTools() {
  const { resetOnboarding } = useOnboarding();

  return (
    <button onClick={resetOnboarding}>
      Reset Onboarding (Dev Only)
    </button>
  );
}
```

### Mock Progress States

```tsx
// For testing different states
const mockProgress = {
  currentStep: 'profile',
  completedSteps: ['account-type'],
};

<OnboardingProgress {...mockProgress} />
```

## Best Practices

1. **Show progress only during onboarding** - Hide it once complete
2. **Save progress to backend** - Don't rely only on localStorage
3. **Allow skipping optional steps** - Like social links
4. **Provide clear CTAs** - Guide users to the next step
5. **Validate before completing** - Ensure data is saved before marking complete
6. **Handle errors gracefully** - Don't mark complete if save fails
7. **Mobile-first design** - Progress indicator is responsive

## Accessibility

- All steps have proper ARIA labels
- Progress bar includes role="progressbar"
- Keyboard navigation supported
- Screen reader friendly
- High contrast colors

## Example: Complete Integration

```tsx
'use client';

import { useState, useEffect } from 'react';
import { OnboardingProgress } from '@/components/onboarding';
import { useOnboarding } from '@/hooks';
import { useRouter } from 'next/navigation';

export default function ProfileSetupPage() {
  const router = useRouter();
  const {
    currentStep,
    completedSteps,
    completeStep,
    isComplete,
    checkAndUpdateProgress,
  } = useOnboarding();

  const [profile, setProfile] = useState({ name: '', username: '' });
  const [saving, setSaving] = useState(false);

  // Load existing data
  useEffect(() => {
    const loadData = async () => {
      const user = await api.getUser();
      setProfile(user);
      
      // Sync progress
      checkAndUpdateProgress({
        accountType: user.accountType,
        profileComplete: user.name && user.username,
      });
    };
    loadData();
  }, [checkAndUpdateProgress]);

  // Redirect if complete
  useEffect(() => {
    if (isComplete) {
      router.push('/dashboard');
    }
  }, [isComplete, router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.saveProfile(profile);
      completeStep('profile');
      router.push('/settings'); // Next step
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <OnboardingProgress
        currentStep={currentStep}
        completedSteps={completedSteps}
        className="mb-8"
      />

      <div className="card p-6">
        <h1 className="text-2xl font-bold mb-4">Set Up Your Profile</h1>
        
        {/* Your form fields */}
        
        <button
          onClick={handleSave}
          disabled={saving || !profile.name || !profile.username}
          className="btn-primary"
        >
          {saving ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
```

## Summary

The onboarding progress component provides:
- ✅ Visual step-by-step progress
- ✅ Persistent state with localStorage
- ✅ Easy integration with existing pages
- ✅ Responsive design (mobile & desktop)
- ✅ Accessible and WCAG compliant
- ✅ Customizable and extensible

For a complete working example, visit `/onboarding` in your browser.
