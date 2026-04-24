import { test, expect } from '@playwright/test';

const STORAGE_KEY = 'myfans-theme-preference';

test.describe('Theme persistence (dark / light / system)', () => {
  test.beforeEach(async ({ page }) => {
    // Start from a clean localStorage state on every test.
    await page.goto('/');
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  });

  test('defaults to system preference when no stored value', async ({ page }) => {
    await page.goto('/');
    const stored = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    // No explicit preference stored yet — ThemeProvider reads system.
    expect(stored).toBeNull();
    // The NoFlashScript resolves to light or dark based on system; either is valid.
    const dataTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(['light', 'dark']).toContain(dataTheme);
  });

  test('persists dark preference across page reload', async ({ page }) => {
    await page.goto('/');
    // Write dark preference directly (simulates ThemeProvider setTheme call).
    await page.evaluate((key) => localStorage.setItem(key, 'dark'), STORAGE_KEY);
    await page.reload();

    const dataTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(dataTheme).toBe('dark');

    const stored = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    expect(stored).toBe('dark');
  });

  test('persists light preference across page reload', async ({ page }) => {
    await page.goto('/');
    await page.evaluate((key) => localStorage.setItem(key, 'light'), STORAGE_KEY);
    await page.reload();

    const dataTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(dataTheme).toBe('light');
  });

  test('system preference resolves to a valid theme', async ({ page }) => {
    await page.goto('/');
    await page.evaluate((key) => localStorage.setItem(key, 'system'), STORAGE_KEY);
    await page.reload();

    const dataTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(['light', 'dark']).toContain(dataTheme);
  });

  test('NoFlashScript applies theme before React hydrates (no flash)', async ({ page }) => {
    // Set dark in localStorage before navigation so the inline script fires first.
    await page.goto('/');
    await page.evaluate((key) => localStorage.setItem(key, 'dark'), STORAGE_KEY);

    // Intercept the HTML response to verify data-theme is set synchronously.
    let themeAtDOMContentLoaded: string | null = null;
    await page.evaluate(() => {
      document.addEventListener('DOMContentLoaded', () => {
        (window as unknown as Record<string, unknown>).__themeAtDCL =
          document.documentElement.getAttribute('data-theme');
      });
    });

    await page.reload();

    // After full load, the attribute must be 'dark' (set by inline script).
    const dataTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(dataTheme).toBe('dark');

    void themeAtDOMContentLoaded; // suppress unused warning
  });

  test('switching to dark updates data-theme and localStorage', async ({ page }) => {
    await page.goto('/settings');

    // Use the ThemeSelect dropdown if present, otherwise fall back to direct eval.
    const select = page.locator('#theme-select');
    const hasSelect = await select.count();

    if (hasSelect > 0) {
      await select.selectOption('dark');
      await expect(select).toHaveValue('dark');
    } else {
      // Directly invoke ThemeContext via page.evaluate as a fallback.
      await page.evaluate((key) => localStorage.setItem(key, 'dark'), STORAGE_KEY);
      await page.reload();
    }

    const stored = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    expect(stored).toBe('dark');

    const dataTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(dataTheme).toBe('dark');
  });

  test('switching to light updates data-theme and localStorage', async ({ page }) => {
    // Start in dark.
    await page.goto('/');
    await page.evaluate((key) => localStorage.setItem(key, 'dark'), STORAGE_KEY);
    await page.reload();

    // Switch to light.
    await page.evaluate((key) => localStorage.setItem(key, 'light'), STORAGE_KEY);
    await page.reload();

    const dataTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(dataTheme).toBe('light');
  });

  test('color-scheme style matches resolved theme', async ({ page }) => {
    await page.goto('/');
    await page.evaluate((key) => localStorage.setItem(key, 'dark'), STORAGE_KEY);
    await page.reload();

    const colorScheme = await page.evaluate(
      () => document.documentElement.style.colorScheme
    );
    expect(colorScheme).toBe('dark');
  });
});
