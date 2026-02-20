## Overview
Implements waiting/lobby components for subscription and transaction pending states.

## Changes
- **`components/pending/PendingStatus.tsx`**: UI component with 4 state variants (pending, processing, success, error), transaction hash display, countdown timer, and contextual actions
- **`clients/PendingStatusClient.tsx`**: Client wrapper with mock state management, 15s countdown, and loading fallback
- **`app/pending/page.tsx`**: Page route at `/pending`

## Implementation
- TypeScript-enabled with exported types
- Uses lucide-react icons, existing UI components (StatusIndicator, Button), and design tokens
- Loading animations, hover effects, responsive CSS-only layout
- Dark mode support, accessible markup
- Auto-cycles through states: pending (0-5s) → processing (5-10s) → success (10s+)

## Testing
```bash
npm run build  # ✅ Passes
npm run dev    # ✅ /pending loads
```

Closes #83
