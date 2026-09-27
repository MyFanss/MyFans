# Accessibility Guidelines

This document outlines the accessibility standards and practices for the MyFans frontend application.

## WCAG 2.1 AA Compliance

We aim to meet WCAG 2.1 AA standards for all user-facing components.

### Key Requirements

#### 1. Keyboard Navigation
- All interactive elements must be keyboard accessible
- Tab order should be logical
- Focus indicators must be visible
- Custom controls must support keyboard interaction

#### 2. Screen Reader Support
- All content must have appropriate semantic markup
- Interactive elements need proper ARIA labels
- Form fields require labels and error messages
- Status changes should be announced

#### 3. Color and Contrast
- Text must have sufficient contrast ratios
- Color should not be the only way to convey information
- Focus indicators must be highly visible

#### 4. Semantic HTML
- Use proper heading hierarchy (h1-h6)
- Use semantic elements (main, nav, section, article, etc.)
- Form elements must be properly associated with labels

## Implementation Checklist

### Navigation
- [x] Skip links for keyboard users
- [x] ARIA labels on navigation elements
- [x] Current page indication with aria-current
- [x] Keyboard support for mobile menu

### Forms
- [x] Proper label association
- [x] Error messages linked to fields
- [x] Required field indication
- [x] Form validation feedback

### Components
- [x] Button components with proper focus styles
- [x] Modal dialogs with focus management
- [x] Loading states announced to screen readers
- [x] Images with appropriate alt text

### Testing
- [x] Automated accessibility linting (eslint-plugin-jsx-a11y)
- [x] Axe-core integration for runtime testing (critical routes)
- [x] Keyboard navigation testing (modal-accessibility e2e)
- [ ] Screen reader testing (planned for future)

## Modal Focus Management

Wallet and other modal dialogs must implement a full focus trap:

- On open, move initial focus into the dialog (first focusable element or the dialog container).
- While open, `Tab` and `Shift+Tab` must cycle within the dialog and never escape to the page behind it.
- On close, restore focus to the element that triggered the dialog.
- The dialog must expose `role="dialog"`, `aria-modal="true"`, and an accessible name via `aria-labelledby` or `aria-label`.
- `Escape` must close the dialog.

These behaviors are covered by `frontend/e2e/modal-accessibility.spec.ts`.

## Consent UI

Consent controls (cookie/analytics consent) must be accessible:

- Use native controls or correct roles (`role="dialog"` for the consent banner, `role="switch"`/checkbox semantics for toggles).
- Every control has a programmatic label associated via `aria-labelledby`/`aria-describedby` or a wrapping `<label>`.
- Fully keyboard operable: focusable controls, visible focus, `Enter`/`Space` activation.
- State changes are announced to assistive tech.

## Loading Skeletons

Skeletons must not be silent decorative divs:

- Mark the loading region with `aria-busy="true"` while loading.
- Expose a live region (`role="status"` or `aria-live="polite"`) announcing the loading state.
- Provide an accessible text alternative (e.g. visually hidden "Loading…") for screen readers.
- Remove `aria-busy` and the announcement once content has loaded.

## Tools and Resources

- **ESLint Plugin**: eslint-plugin-jsx-a11y
- **Testing**: axe-core with Jest and Playwright
- **Browser DevTools**: Accessibility tab
- **Screen Readers**: NVDA, JAWS, VoiceOver

## Running Accessibility Tests

```bash
# Run linting with accessibility rules
npm run lint

# Run modal accessibility e2e
npx playwright test e2e/modal-accessibility.spec.ts
```

Axe-core checks run against critical routes in CI. Do not disable accessibility lint rules to make checks pass — see `frontend/docs/LINT_POLICY.md`.

## Common Issues and Fixes

### Missing ARIA Labels
```tsx
// Bad
<button onClick={handleClick}>Save</button>

// Good
<button onClick={handleClick} aria-label="Save changes">Save</button>
```

### Poor Color Contrast
```tsx
// Bad
<p className="text-gray-400">Important information</p>

// Good
<p className="text-gray-900 dark:text-gray-100">Important information</p>
```

### Missing Focus Management
```tsx
// Bad
<div className="modal">...</div>

// Good
<div className="modal" role="dialog" aria-modal="true" tabIndex={-1}>...</div>
```

### Silent Loading Skeletons
```tsx
// Bad
<div className="skeleton" />

// Good
<div className="skeleton" role="status" aria-busy="true" aria-live="polite">
  <span className="sr-only">Loading…</span>
</div>
```