'use client';

import { useTheme, type Theme } from '@/contexts/ThemeContext';

/**
 * ThemeToggle - Button to toggle between light and dark themes
 *
 * Features:
 * - Shows sun icon in dark mode, moon icon in light mode
 * - Accessible with proper aria labels
 * - Supports keyboard navigation
 *
 * @example
 * ```tsx
 * <ThemeToggle />
 * ```
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      type="button"
    >
      {theme === 'light' ? (
        // Moon icon for light mode (click to go dark)
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
          />
        </svg>
      ) : (
        // Sun icon for dark mode (click to go light)
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
          />
        </svg>
      )}
    </button>
  );
}

/**
 * ThemeSelect - Dropdown to select theme preference
 *
 * Allows selection of 'light', 'dark', or 'system' themes.
 *
 * @example
 * ```tsx
 * <ThemeSelect />
 * ```
 */
export function ThemeSelect() {
  const { preference, setTheme } = useTheme();

  const options: { value: Theme; label: string; description: string }[] = [
    {
      value: 'light',
      label: 'Light',
      description: 'Always use light mode',
    },
    {
      value: 'dark',
      label: 'Dark',
      description: 'Always use dark mode',
    },
    {
      value: 'system',
      label: 'System',
      description: 'Follow system preference',
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="theme-select"
        className="text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        Theme
      </label>
      <select
        id="theme-select"
        value={preference}
        onChange={(e) => setTheme(e.target.value as Theme)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {options.find((o) => o.value === preference)?.description}
      </p>
    </div>
  );
}

/**
 * ThemeToggleWithLabel - Theme toggle with label and current state
 *
 * @example
 * ```tsx
 * <ThemeToggleWithLabel />
 * ```
 */
export function ThemeToggleWithLabel() {
  const { theme, preference, toggleTheme } = useTheme();

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Appearance
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {preference === 'system'
            ? 'Following system preference'
            : `Using ${theme} mode`}
        </p>
      </div>
      <button
        onClick={toggleTheme}
        className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        type="button"
      >
        {theme === 'light' ? (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
              />
            </svg>
            Light
          </>
        ) : (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
              />
            </svg>
            Dark
          </>
        )}
      </button>
    </div>
  );
}
