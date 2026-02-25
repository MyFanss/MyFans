# Onboarding Progress Component

A step-by-step progress indicator for the MyFans onboarding flow.

## Features

✅ **Visual Progress** - Shows current, completed, and upcoming steps  
✅ **Responsive Design** - Vertical layout on mobile, horizontal on desktop  
✅ **Progress Bar** - Visual percentage indicator of completion  
✅ **State Management** - Persistent state using localStorage  
✅ **Accessible** - WCAG-compliant with proper ARIA labels  

## Onboarding Steps

The onboarding flow consists of 4 steps:

1. **Account Type** - Choose between Creator, Fan, or Both
2. **Profile** - Set up display name, username, and bio
3. **Social Links** - Connect social media profiles (optional)
4. **Verification** - Connect wallet to verify account

## Usage

### Basic Implementation

```tsx
import { OnboardingProgress } from '@/components/onboarding';
import { useOnboarding } from '@/hooks';

export default function OnboardingPage() {
  const { currentStep, completedSteps, completeStep } = useOnboarding();

  return (
    <div>
      <OnboardingProgress
        currentStep={currentStep}
        completedSteps={completedSteps}
      />
      
      {/* Your step content here */}
      
      <button onClick={() => completeStep('account-type')}>
        Complete Step
      </button>
    </div>
  );
}
```

### With Full Onboarding Flow

See `/app/onboarding/page.tsx` for a complete implementation example.

## Components

### OnboardingProgress

Visual progress indicator component.

**Props:**
- `currentStep` (required): The current active step
- `completedSteps` (required): Array of completed step IDs
- `className` (optional): Additional CSS classes

**Example:**
```tsx
<OnboardingProgress
  currentStep="profile"
  completedSteps={['account-type']}
  className="mb-8"
/>
```

## Hooks

### useOnboarding

Hook for managing onboarding state with localStorage persistence.

**Returns:**
- `currentStep`: Current active step
- `completedSteps`: Array of completed steps
- `isComplete`: Boolean indicating if all steps are done
- `completeStep(step)`: Function to mark a step as complete
- `goToStep(step)`: Function to navigate to a specific step
- `resetOnboarding()`: Function to reset all progress
- `checkAndUpdateProgress(data)`: Function to update progress based on saved data

**Example:**
```tsx
const {
  currentStep,
  completedSteps,
  isComplete,
  completeStep,
  goToStep,
  resetOnboarding,
} = useOnboarding();

// Mark step as complete
completeStep('account-type');

// Navigate to specific step
goToStep('profile');

// Reset all progress
resetOnboarding();
```

## Step States

Each step can be in one of three states:

- **Completed** - Green checkmark, step is done
- **Current** - Purple highlight with ring, user is here
- **Upcoming** - Gray, not yet reached

## Persistence

The onboarding state is automatically saved to localStorage under the key `myfans_onboarding_state`. This allows users to resume their progress if they leave and return.

## Integration with Backend

To integrate with your backend:

1. Call `completeStep()` after successfully saving data to the backend
2. Use `checkAndUpdateProgress()` to sync state when loading user data
3. Clear localStorage on logout or account deletion

**Example:**
```tsx
const { completeStep, checkAndUpdateProgress } = useOnboarding();

// After saving profile data
const handleSaveProfile = async (data) => {
  await api.saveProfile(data);
  completeStep('profile');
};

// When loading user data
useEffect(() => {
  const userData = await api.getUserData();
  checkAndUpdateProgress({
    accountType: userData.accountType,
    profileComplete: userData.hasProfile,
    socialLinksComplete: userData.hasSocialLinks,
    verificationComplete: userData.isVerified,
  });
}, []);
```

## Styling

The component uses Tailwind CSS with the following color scheme:

- **Completed**: Green (`green-500`)
- **Current**: Purple (`purple-500`)
- **Upcoming**: Gray (`gray-300`)
- **Progress Bar**: Gradient from purple to green

## Accessibility

- Proper ARIA labels on all interactive elements
- Progress bar with `role="progressbar"` and aria attributes
- Keyboard navigable
- Screen reader friendly
- High contrast colors for visibility

## Demo

Visit `/onboarding` to see the full interactive demo with all steps.

## Customization

To add or modify steps:

1. Update the `ONBOARDING_STEPS` array in `OnboardingProgress.tsx`
2. Update the `OnboardingStep` type
3. Update the `STEP_ORDER` array in `useOnboarding.ts`
4. Add corresponding UI in your onboarding page

**Example:**
```tsx
const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  // ... existing steps
  {
    id: 'payment-setup',
    label: 'Payment',
    description: 'Add payment method',
  },
];
```
