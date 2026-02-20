# AccountType Component

A professional, accessible account status badge component for the MyFans platform.

## Features

✅ **Labels and Badges** - Four distinct status types with visual badges  
✅ **Instructional Text** - Clear guidance for each account type  
✅ **Contrast** - WCAG-compliant colors for light and dark modes  
✅ **Extensible** - Easy to add new status types via configuration

## Status Types

| Status | Badge | Description |
|--------|-------|-------------|
| `creator` | ✨ Creator | Can create content and earn from subscriptions |
| `fan` | 💙 Fan | Can subscribe to creators and access exclusive content |
| `both` | ⭐ Creator & Fan | Can create content and subscribe to other creators |
| `none` | 👤 New User | New user who hasn't chosen a role yet |

## Usage

```tsx
import { AccountType } from '@/components';

export default function ProfilePage() {
  return (
    <div>
      <AccountType status="creator" />
    </div>
  );
}
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `status` | `'creator' \| 'fan' \| 'both' \| 'none'` | Yes | - | The account type to display |
| `className` | `string` | No | `''` | Additional CSS classes |

## Accessibility

- Semantic HTML with proper ARIA labels
- High contrast colors (WCAG AA compliant)
- Screen reader friendly with role="status"
- Keyboard navigable

## Extending

To add new status types, edit the `statusConfig` object in `AccountType.tsx`:

```tsx
const statusConfig = {
  // ... existing statuses
  premium: {
    label: 'Premium Creator',
    bgColor: 'bg-gold-100 dark:bg-gold-900/30',
    textColor: 'text-gold-800 dark:text-gold-200',
    borderColor: 'border-gold-300 dark:border-gold-700',
    icon: '👑',
  },
};
```

## Design System

The component uses Tailwind CSS with custom color variables defined in `globals.css` for consistent theming across light and dark modes.
