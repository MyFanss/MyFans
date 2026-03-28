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
- [ ] Axe-core integration for runtime testing (planned for future)
- [ ] Keyboard navigation testing (planned for future)
- [ ] Screen reader testing (planned for future)

## Tools and Resources

- **ESLint Plugin**: eslint-plugin-jsx-a11y
- **Testing**: axe-core with Jest
- **Browser DevTools**: Accessibility tab
- **Screen Readers**: NVDA, JAWS, VoiceOver

## Running Accessibility Tests

```bash
# Run linting with accessibility rules
npm run lint
```

Note: Automated accessibility testing with Jest and axe-core is planned for future implementation.

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