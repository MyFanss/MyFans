# Accessible Modal Component

A fully accessible modal dialog component that meets WCAG 2.1 AA standards.

## Features

### ✅ Focus Management
- **Focus Trap**: Keyboard focus is trapped within the modal when open
- **Initial Focus**: Automatically focuses the first focusable element
- **Focus Restoration**: Returns focus to the trigger element when closed
- **Tab Navigation**: Supports both Tab and Shift+Tab navigation
- **Circular Focus**: Focus cycles from last to first element and vice versa

### ✅ Keyboard Support
- **Escape Key**: Closes the modal (configurable)
- **Tab Key**: Navigates through focusable elements
- **Shift+Tab**: Navigates backwards through focusable elements

### ✅ ARIA Attributes
- `role="dialog"`: Identifies the element as a dialog
- `aria-modal="true"`: Indicates the modal is modal
- `aria-labelledby`: References the modal title for screen readers
- `aria-describedby`: Can reference additional descriptive content

### ✅ Background Scroll Prevention
- Prevents scrolling of background content when modal is open
- Accounts for scrollbar width to prevent layout shift
- Restores original scroll behavior when closed

### ✅ Backdrop Interaction
- Clicking backdrop closes modal (configurable)
- Backdrop is marked with `aria-hidden="true"`

## Usage

```tsx
import { Modal } from '@/components/ui/Modal';

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        Open Modal
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="My Modal Title"
        size="md"
      >
        <p>Modal content goes here</p>
        <button onClick={() => setIsOpen(false)}>Close</button>
      </Modal>
    </>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | `boolean` | required | Controls modal visibility |
| `onClose` | `() => void` | required | Callback when modal should close |
| `title` | `string` | required | Modal title (used for aria-labelledby) |
| `children` | `ReactNode` | required | Modal content |
| `className` | `string` | `''` | Additional CSS classes for modal container |
| `closeOnBackdropClick` | `boolean` | `true` | Whether clicking backdrop closes modal |
| `closeOnEscape` | `boolean` | `true` | Whether Escape key closes modal |
| `preventBackgroundScroll` | `boolean` | `true` | Whether to prevent background scrolling |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | Modal width |

## Accessibility Checklist

- [x] Focus trap implemented
- [x] Escape key handling
- [x] Focus restoration on close
- [x] Proper ARIA attributes (role, aria-modal, aria-labelledby)
- [x] Background scroll prevention
- [x] Keyboard navigation support
- [x] Close button with aria-label
- [x] Backdrop marked as aria-hidden
- [x] Tested with screen readers
- [x] E2E tests for accessibility

## Testing

Run the accessibility tests:

```bash
npm run test:e2e -- modal-accessibility.spec.ts
```

## Examples in Codebase

### Wallet Selection Modal
Location: `frontend/src/components/wallet/WalletSelectionModal.tsx`
- Custom implementation with focus trap
- Prevents background scroll
- Handles connection states

### Settings Delete Modal
Location: `frontend/src/app/settings/page.tsx`
- Form inputs with proper labels
- Error announcements with role="alert"
- Confirmation workflow

### Subscription Cancel Modal
Location: `frontend/src/app/subscriptions/page.tsx`
- Simple confirmation dialog
- Focus management
- Accessible button states

## Best Practices

1. **Always provide a title**: The title is used for `aria-labelledby`
2. **Use semantic HTML**: Use `<button>` for actions, not `<div>`
3. **Provide clear labels**: All interactive elements should have clear labels
4. **Handle loading states**: Disable actions during async operations
5. **Announce dynamic content**: Use `role="alert"` or `aria-live` for status updates
6. **Test with keyboard only**: Ensure all functionality is keyboard accessible
7. **Test with screen readers**: Verify the experience with NVDA, JAWS, or VoiceOver

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Screen readers: NVDA, JAWS, VoiceOver

## References

- [WAI-ARIA Authoring Practices: Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN: ARIA Dialog Role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/dialog_role)
