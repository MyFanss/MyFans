'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  /** Current resolved theme ('light' or 'dark') */
  theme: 'light' | 'dark';
  /** User's theme preference (can be 'system') */
  preference: Theme;
  /** Set theme preference */
  setTheme: (theme: Theme) => void;
  /** Toggle between light and dark */
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'myfans-theme-preference';

/**
 * Get the system theme preference
 */
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * Get the stored theme preference from localStorage
 */
function getStoredPreference(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

/**
 * Resolve theme preference to actual theme
 */
function resolveTheme(preference: Theme): 'light' | 'dark' {
  if (preference === 'system') {
    return getSystemTheme();
  }
  return preference;
}

interface ThemeProviderProps {
  children: ReactNode;
  /** Default theme preference (defaults to 'system') */
  defaultTheme?: Theme;
}

/**
 * ThemeProvider - Manages theme state and persistence
 *
 * Features:
 * - Persists theme preference to localStorage
 * - Supports 'light', 'dark', and 'system' preferences
 * - Listens to system theme changes
 * - No flash on page load (use with NoFlashScript)
 *
 * @example
 * ```tsx
 * <ThemeProvider>
 *   <App />
 * </ThemeProvider>
 * ```
 */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: ThemeProviderProps) {
  // Use lazy initialization to read from localStorage once on mount
  const [preference, setPreference] = useState<Theme>(() => {
    if (typeof window === 'undefined') return defaultTheme;
    return getStoredPreference();
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const pref = getStoredPreference();
    return resolveTheme(pref);
  });

  // Apply theme to document whenever it changes
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', resolvedTheme);
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  // Listen for system theme changes when preference is 'system'
  useEffect(() => {
    if (preference !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      setResolvedTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [preference]);

  // Set theme preference
  const setTheme = useCallback((newTheme: Theme) => {
    setPreference(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    setResolvedTheme(resolveTheme(newTheme));
  }, []);

  // Toggle between light and dark (ignores system)
  const toggleTheme = useCallback(() => {
    const newTheme = resolvedTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }, [resolvedTheme, setTheme]);

  return (
    <ThemeContext.Provider
      value={{
        theme: resolvedTheme,
        preference,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * useTheme - Hook to access theme context
 *
 * @throws Error if used outside ThemeProvider
 * @returns ThemeContextValue
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
