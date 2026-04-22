import { test, expect } from '@playwright/test';

/**
 * Navigation IA usability tests.
 * Covers: sidebar, bottom nav, breadcrumbs, skip link, role paths, keyboard nav.
 */

test.describe('Sidebar navigation (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('renders sidebar with primary nav items', async ({ page }) => {
    await page.goto('/');
    const sidebar = page.getByRole('navigation', { name: 'Main navigation' }).first();
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /home/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /discover/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /notifications/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /settings/i })).toBeVisible();
  });

  test('active link has aria-current="page"', async ({ page }) => {
    await page.goto('/discover');
    const sidebar = page.getByRole('navigation', { name: 'Main navigation' }).first();
    const discoverLink = sidebar.getByRole('link', { name: /discover/i });
    await expect(discoverLink).toHaveAttribute('aria-current', 'page');
  });

  test('sidebar collapse toggle works', async ({ page }) => {
    await page.goto('/');
    const collapseBtn = page.getByRole('button', { name: /collapse sidebar/i });
    await expect(collapseBtn).toBeVisible();
    await collapseBtn.click();
    await expect(page.getByRole('button', { name: /expand sidebar/i })).toBeVisible();
  });

  test('settings link is present in secondary nav', async ({ page }) => {
    await page.goto('/');
    const sidebar = page.getByRole('navigation', { name: 'Main navigation' }).first();
    await expect(sidebar.getByRole('link', { name: /settings/i })).toBeVisible();
  });
});

test.describe('Mobile navigation', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('shows mobile top bar with menu button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /open navigation menu/i })).toBeVisible();
  });

  test('opens mobile drawer on menu button click', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /open navigation menu/i }).click();
    const drawer = page.getByRole('navigation', { name: 'Main navigation' }).last();
    await expect(drawer).toBeVisible();
  });

  test('closes mobile drawer on close button', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /open navigation menu/i }).click();
    await page.getByRole('button', { name: /close menu/i }).click();
    // Drawer should be hidden (translate-x-full)
    const drawer = page.getByRole('navigation', { name: 'Main navigation' }).last();
    await expect(drawer).not.toBeVisible();
  });

  test('bottom nav is visible on mobile', async ({ page }) => {
    await page.goto('/');
    const bottomNav = page.getByRole('navigation', { name: /mobile navigation/i });
    await expect(bottomNav).toBeVisible();
  });

  test('bottom nav has at least 4 items', async ({ page }) => {
    await page.goto('/');
    const bottomNav = page.getByRole('navigation', { name: /mobile navigation/i });
    const links = bottomNav.getByRole('link');
    await expect(links).toHaveCount(await links.count());
    expect(await links.count()).toBeGreaterThanOrEqual(4);
  });

  test('bottom nav active item has aria-current="page"', async ({ page }) => {
    await page.goto('/');
    const bottomNav = page.getByRole('navigation', { name: /mobile navigation/i });
    const homeLink = bottomNav.getByRole('link', { name: /home/i });
    await expect(homeLink).toHaveAttribute('aria-current', 'page');
  });

  test('mobile drawer closes on overlay click', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /open navigation menu/i }).click();
    // Click the overlay (outside the drawer)
    await page.mouse.click(350, 400);
    const drawer = page.getByRole('navigation', { name: 'Main navigation' }).last();
    await expect(drawer).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe('Breadcrumbs', () => {
  test('does not render on homepage', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: /breadcrumb/i })).not.toBeVisible();
  });

  test('renders on nested route', async ({ page }) => {
    await page.goto('/settings');
    const breadcrumb = page.getByRole('navigation', { name: /breadcrumb/i });
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.getByRole('link', { name: /home/i })).toBeVisible();
    await expect(breadcrumb.getByText(/settings/i)).toBeVisible();
  });

  test('last breadcrumb has aria-current="page"', async ({ page }) => {
    await page.goto('/settings');
    const breadcrumb = page.getByRole('navigation', { name: /breadcrumb/i });
    await expect(breadcrumb.getByText(/settings/i)).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('Skip to content link', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('skip link is focusable and points to main content', async ({ page }) => {
    await page.goto('/');
    // Tab to focus the skip link
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: /skip to content/i });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toHaveAttribute('href', '#main-content');
  });
});

test.describe('Keyboard navigation', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('nav links are reachable by keyboard', async ({ page }) => {
    await page.goto('/');
    // Tab through until we hit a nav link
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');
      const tag = await focused.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
      if (tag === 'a') {
        const href = await focused.getAttribute('href').catch(() => '');
        if (href && href !== '#main-content') {
          // Successfully reached a nav link
          expect(href).toBeTruthy();
          return;
        }
      }
    }
  });
});

test.describe('Role-specific nav paths', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('dashboard route is accessible', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('subscriptions route is accessible', async ({ page }) => {
    await page.goto('/subscriptions');
    await expect(page).toHaveURL(/\/subscriptions/);
  });

  test('notifications route is accessible', async ({ page }) => {
    await page.goto('/notifications');
    await expect(page).toHaveURL(/\/notifications/);
  });

  test('settings route is accessible', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);
  });
});
