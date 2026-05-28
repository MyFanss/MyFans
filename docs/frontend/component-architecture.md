# Frontend Component Architecture

This guide is the fastest way to get aligned with the frontend in `frontend/`. It focuses on where code lives, how route files should stay small, and which patterns are already used in the repo.

## At A Glance

The frontend is a Next.js App Router app. Most new work falls into one of these folders:

```text
frontend/src/
├── app/         # Routes, pages, layouts, and route-level composition
├── clients/     # Client-only wrappers used by routes when SSR boundaries matter
├── components/  # Reusable UI plus feature-focused component groups
├── contexts/    # Cross-cutting React providers
├── hooks/       # Reusable client-side logic
├── lib/         # Data access, transforms, and feature utilities
├── test/        # Shared test setup
└── types/       # Shared TypeScript types and error models
```

## Where New Code Should Go

### `app/`

Use route files for composition, not for deep UI trees or reusable logic. A page should usually:

- read route params or search params
- compose feature components
- choose loading, error, and layout boundaries
- keep one-off page state only when it is truly route-specific

If logic or markup starts getting reused, move it into `components/`, `hooks/`, or `lib/`.

### `components/`

This repo uses both shared UI components and feature-oriented component folders.

- `components/ui`: low-level reusable inputs and status primitives like `Input`, `Select`, `Badge`, and `StatusIndicator`
- `components/navigation`: app shell pieces like `Sidebar`, `BottomNav`, and `Breadcrumbs`
- feature folders like `components/earnings`, `components/dashboard`, `components/wallet`, `components/checkout`, `components/settings`

Prefer a feature folder when the component is mainly useful in one product area. Prefer `components/ui` when the component is generic enough to reuse across multiple screens.

### `contexts/`

Put providers here only for state that truly spans large parts of the app, such as theme state. Reach for a context after simpler prop composition or a hook is no longer enough.

### `hooks/`

Extract a hook when multiple components need the same behavior or when a component becomes hard to read because of stateful logic. Hooks in this repo usually own state transitions and expose a small API back to the UI.

### `lib/`

Use `lib/` for data-fetching helpers, normalization, calculations, and feature utilities that should not live inside JSX. Examples in the repo include earnings helpers and typed error creation.

### `clients/`

Use `clients/` for client-only entry points when a route needs a clear server/client boundary without pushing that concern into every child component.

## Common Patterns

### Keep Route Files Thin

Route files should mostly compose existing pieces:

```tsx
// frontend/src/app/earnings/page.tsx
import {
  EarningsSummaryCard,
  EarningsBreakdownCard,
  TransactionHistoryCard,
} from '@/components/earnings';

export default function EarningsPage() {
  return (
    <main>
      <EarningsSummaryCard days={30} />
      <EarningsBreakdownCard days={30} />
      <TransactionHistoryCard limit={20} />
    </main>
  );
}
```

When a page grows beyond composition plus a little page-specific state, move reusable parts down into `components/` or `hooks/`.

### Group Feature Components By Domain

Feature folders should export a small surface through an `index.ts` file:

```tsx
// frontend/src/components/earnings/index.ts
export { EarningsSummaryCard } from './EarningsSummary';
export { EarningsBreakdownCard } from './EarningsBreakdown';
export { TransactionHistoryCard } from './TransactionHistory';
```

That keeps route imports clean and makes the folder easier to navigate.

### Keep Shared UI Components Generic

Components in `components/ui` should stay prop-driven and domain-neutral:

```tsx
// frontend/src/components/ui/Badge.tsx
export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline';
  className?: string;
}
```

If a component starts to depend on earnings, subscriptions, wallets, or creators, it likely belongs in a feature folder instead.

### Extract Stateful Logic Into Hooks

Hooks are the right place for multi-step client logic:

```tsx
// frontend/src/hooks/useTransaction.ts
export function useTransaction<T = unknown>(options: TransactionOptions = {}) {
  const [state, setState] = useState<TransactionState>('idle');
  const [error, setError] = useState<AppError | null>(null);

  const execute = useCallback(async (fn: () => Promise<T>) => {
    setState('pending');
    setError(null);
    // ...
  }, []);

  return { state, error, execute };
}
```

Prefer components that render from hook state over components that hide large async workflows inline.

### Use Error Boundaries At Feature Edges

Wrap larger feature sections so a single crash does not take down the full route:

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

<ErrorBoundary>
  <FeatureSection />
</ErrorBoundary>
```

Use a boundary around unstable or data-heavy areas, not around every tiny leaf component.

### Keep Cross-Cutting Providers In Layouts

App-wide providers belong near the root layout:

```tsx
// frontend/src/app/layout.tsx
<ThemeProvider>
  <ToastProvider>{children}</ToastProvider>
</ThemeProvider>
```

Add a provider only when multiple distant parts of the app truly need shared reactive state.

## Naming And File Conventions

- Components: `PascalCase.tsx`
- Hooks: `useSomething.ts`
- Utilities in `lib/`: descriptive `camel-case` or feature-based names already used in the repo like `earnings-api.ts`
- Shared exports: add `index.ts` only when it makes imports clearer
- Tests: keep them next to the component or hook when the repo already does that for the area

## Practical Checklist

Before opening a frontend PR, check:

- Is this route file mostly composition, not business logic?
- Does this belong in `components/ui` or in a feature folder?
- Should repeated stateful logic move into a hook?
- Can API and data shaping live in `lib/` instead of inside JSX?
- Does a new cross-cutting provider really need to exist?
- Should this feature area be wrapped in an `ErrorBoundary`?

## Related Docs

- [Frontend README](../../frontend/README.md)
- [Component Reference](../../frontend/README_COMPONENTS.md)
- [Feature Flags](../feature-flags.md)

## Earnings Reconciliation Report

The reconciliation report lives entirely in the earnings feature area.

| File | Role |
|------|------|
| `components/earnings/ReconciliationReport.tsx` | UI: date-range filters, gross/fees/net table, pagination, Export CSV button |
| `lib/earnings-api.ts` — `fetchReconciliationReport` | Calls `GET /v1/analytics/earnings?from=&to=&page=&limit=` |
| `lib/earnings-api.ts` — `ReconciliationRow`, `ReconciliationReport` | Shared types matching the backend `EarningsSummary` shape |
| `lib/earnings-export.ts` — `reconciliationToCSV` | Serialises `ReconciliationRow[]` to CSV (Creator, Asset, Gross, Protocol Fees, Net, Payments) |
| `lib/__tests__/earnings-export.test.ts` | Unit tests for `reconciliationToCSV` |

### Backend endpoint

`GET /v1/analytics/earnings` (NestJS `AnalyticsController`) accepts `creator`, `from`, `to`, `page`, `limit` query params and returns a paginated list of `EarningsSummary` objects (gross, fees, net per creator+asset).

### Manual checklist

1. Navigate to `/earnings`.
2. Scroll to the **Earnings Reconciliation** card.
3. Change the date range — table reloads.
4. Click **Export CSV** — a file named `reconciliation-<from>-to-<to>.csv` downloads.
5. Open the CSV: verify header row is `Creator,Asset,Gross,Protocol Fees,Net,Payments` and data rows match the table.
6. With no data in range, the Export button is disabled.
