/**
 * NoFlashScript - Inline script to prevent flash of wrong theme
 *
 * This script runs before React hydrates to immediately apply the saved theme.
 * It must be placed in the <head> of the document.
 *
 * How it works:
 * 1. Reads theme preference from localStorage
 * 2. Resolves to 'light' or 'dark' (checking system preference if needed)
 * 3. Applies data-theme attribute to <html> immediately
 * 4. Sets color-scheme for native form elements
 *
 * This prevents the "flash" where the page loads in light mode
 * and then switches to dark mode after React loads.
 */

export function NoFlashScript() {
  const script = `
(function() {
  try {
    var storageKey = 'myfans-theme-preference';
    var stored = localStorage.getItem(storageKey);
    var theme = stored;
    
    // If no preference or 'system', check system preference
    if (!theme || theme === 'system') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches 
        ? 'dark' 
        : 'light';
    }
    
    // Apply theme immediately
    var root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
  } catch (e) {
    // If localStorage is not available, default to light
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  );
}

/**
 * NoFlashScriptString - Returns the script as a string for use in next.config.ts
 *
 * Use this if you need to inject the script via next.config.ts
 * instead of the layout component.
 */
export function getNoFlashScriptString(): string {
  return `
(function() {
  try {
    var storageKey = 'myfans-theme-preference';
    var stored = localStorage.getItem(storageKey);
    var theme = stored;
    
    if (!theme || theme === 'system') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches 
        ? 'dark' 
        : 'light';
    }
    
    var root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;
}
