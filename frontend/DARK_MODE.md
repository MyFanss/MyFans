# Dark Mode Implementation

## Overview

MyFans now includes a complete dark mode implementation with system preference detection and user preference persistence. The implementation is built using CSS custom properties, Tailwind CSS dark mode utilities, and React context for state management.

## Architecture

### Components

1. **ThemeContext** (`src/contexts/ThemeContext.tsx`)
   - Manages theme state (current theme, user preference, methods to change)
   - Persists preference to localStorage
   - Listens for system theme changes
   - Provides `useTheme()` hook for consuming components

2. **ThemeToggle** (`src/components/ThemeToggle.tsx`)
   - Quick toggle button between light/dark modes
   - Shows moon icon in light mode, sun icon in dark mode
   - Fully accessible with ARIA labels

3. **ThemeSelect** (`src/components/ThemeToggle.tsx`)
   - Dropdown selector for all three theme options (light, dark, system)
   - Used in settings page

4. **NoFlashScript** (`src/components/NoFlashScript.tsx`)
   - Inline script that runs before React hydrates
   - Prevents "flash of wrong theme" on page load
   - Reads localStorage and applies theme immediately

5. **Settings Page** (`src/app/settings/page.tsx`)
   - Full theme appearance section with visual feedback
   - Shows current theme mode and explains preferences
   - Accessible button group for selection

### CSS Variables

Light mode color tokens (`:root`):

```css
--background: #ffffff;
--foreground: #171717;
--card-bg: #ffffff;
--card-border: #e5e7eb;
--primary-50 through --primary-900: Sky blue shades
--success-50 through --success-700: Green shades
--warning-50 through --warning-700: Amber shades
--error-50 through --error-700: Red shades
--info-50 through --info-700: Blue shades
```

Dark mode overrides (`[data-theme="dark"]`):

- Inverted background/foreground colors
- Adjusted semantic colors for visibility
- Darker card backgrounds
- Lighter text colors

All tokens follow WCAG AA contrast requirements (4.5:1 for text).

## Usage

### Using the useTheme Hook

```typescript
import { useTheme } from '@/contexts/ThemeContext';

export function MyComponent() {
  const { theme, preference, setTheme, toggleTheme } = useTheme();

  return (
    <>
      <p>Current theme: {theme}</p>
      <p>User preference: {preference}</p>
      <button onClick={toggleTheme}>Toggle theme</button>
      <button onClick={() => setTheme('dark')}>Set dark</button>
    </>
  );
}
```

### Adding Dark Mode Styles

Use Tailwind's `dark:` prefix:

```jsx
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  Content that works in both modes
</div>
```

Or use CSS variables:

```css
.card {
  background: var(--card-bg);
  color: var(--foreground);
  border-color: var(--card-border);
}
```

### Theme Options

- `'light'`: Always use light mode
- `'dark'`: Always use dark mode
- `'system'`: Follow system preference (default)

## Accessibility

- All color combinations meet WCAG AA (4.5:1) or AAA (7:1) contrast ratios
- Theme toggle has proper `aria-label` attributes
- Settings buttons have `aria-pressed` attributes
- Keyboard navigation fully supported
- No reliance on color alone to convey information

## Storage

Theme preference is persisted to localStorage with key `"myfans-theme-preference"`.

If localStorage is unavailable, the app gracefully falls back to system preference detection via `prefers-color-scheme` media query.

## Browser Support

- Modern browsers with CSS custom properties support
- `prefers-color-scheme` media query support
- localStorage support
- Falls back to light mode if all systems fail

## Testing

Three test suites are provided:

1. **ThemeContext.test.tsx** - Context logic and state management
2. **ThemeToggle.test.tsx** - All toggle components
3. **NoFlashScript.test.tsx** - Flash prevention script
4. **appearance.test.tsx** - Settings page integration

Run tests:

```bash
npm test
```

## Performance

- NoFlashScript is ~500 bytes inline, runs synchronously in `<head>`
- Theme context uses lazy initialization to minimize re-renders
- CSS variables are computed at runtime but cached by browser
- No JavaScript required for dark mode CSS to apply

## Troubleshooting

### Page flashes light theme on load

Ensure `<NoFlashScript />` is in the `<head>` of your layout and runs before React hydrates.

### Theme not persisting

Check browser localStorage is enabled. Look for `myfans-theme-preference` key in DevTools.

### Dark mode styles not applying

- Verify component uses `dark:` Tailwind prefix or CSS variables
- Check CSS output isn't being purged
- Ensure `data-theme="dark"` attribute is on `<html>` element

## Future Enhancements

- Auto-detection of user preferences on first visit
- Scheduled theme switching (e.g., dark at sunset)
- Per-component theme overrides
- Custom color palette support
