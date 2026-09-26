import { test, expect } from '@playwright/test';

test.describe('Network Status Indicator (#409)', () => {
    test('should display "System Operational" when health is ok', async ({ page }) => {
        // Mock healthy response
        await page.route('**/api/v1/health', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    status: 'ok',
                    timestamp: new Date().toISOString(),
                    components: { database: 'up', soroban: 'up' },
                }),
            });
        });

        await page.goto('/', { waitUntil: 'domcontentloaded' });
        const statusLabel = page.getByText('System Operational');
        await expect(statusLabel).toBeVisible();

        // Check for green dot (simplified check)
        const dot = page.locator('.animate-pulse');
        await expect(dot).toBeVisible();
    });

    test('should display "Degraded Performance" when health is degraded', async ({ page }) => {
        // Mock degraded response
        await page.route('**/api/v1/health', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    status: 'degraded',
                    timestamp: new Date().toISOString(),
                    components: { database: 'up', soroban: 'down' },
                }),
            });
        });

        await page.goto('/', { waitUntil: 'domcontentloaded' });
        const statusLabel = page.getByText('Degraded Performance');
        await expect(statusLabel).toBeVisible();
    });

    test('should display "Service Offline" when health is down', async ({ page }) => {
        // Mock down response
        await page.route('**/api/v1/health', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    status: 'down',
                    timestamp: new Date().toISOString(),
                    components: { database: 'down', soroban: 'down' },
                }),
            });
        });

        await page.goto('/', { waitUntil: 'domcontentloaded' });
        const statusLabel = page.getByText('Service Offline');
        await expect(statusLabel).toBeVisible();
    });

    test('should display "Connection Lost" when API fails', async ({ page }) => {
        // Mock API failure
        await page.route('**/api/v1/health', async (route) => {
            await route.abort('failed');
        });

        await page.goto('/', { waitUntil: 'domcontentloaded' });
        const statusLabel = page.getByText('Connection Lost');
        await expect(statusLabel).toBeVisible();
    });
});

test.describe('Network Guard (#1813)', () => {
    test('should show persistent mismatch banner when wallet network differs from expected', async ({ page }) => {
        // Simulate a wallet reporting a different network than the app expects.
        await page.addInitScript(() => {
            (window as unknown as { __NETWORK_GUARD_MISMATCH__?: boolean }).__NETWORK_GUARD_MISMATCH__ = true;
        });

        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const banner = page.getByRole('alert').filter({ hasText: /network mismatch/i });
        await expect(banner).toBeVisible();
        await expect(banner).toContainText(/expected/i);
        await expect(banner).toContainText(/actual/i);
    });

    test('should hard-block mutating calls while network is mismatched', async ({ page }) => {
        await page.addInitScript(() => {
            (window as unknown as { __NETWORK_GUARD_MISMATCH__?: boolean }).__NETWORK_GUARD_MISMATCH__ = true;
        });

        await page.goto('/', { waitUntil: 'domcontentloaded' });

        // Mutating actions must be disabled/blocked when the guard fails closed.
        const mutateButton = page.getByRole('button', { name: /send|swap|stake|deposit|withdraw/i }).first();
        if (await mutateButton.count()) {
            await expect(mutateButton).toBeDisabled();
        }

        // The mismatch banner must remain visible (persistent, not dismissible).
        const banner = page.getByRole('alert').filter({ hasText: /network mismatch/i });
        await expect(banner).toBeVisible();
    });

    test('should fail closed on unknown/unreachable network', async ({ page }) => {
        await page.route('**/api/v1/health', async (route) => {
            await route.abort('failed');
        });

        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const banner = page.getByRole('alert').filter({ hasText: /network mismatch/i });
        await expect(banner).toBeVisible();
    });
});
