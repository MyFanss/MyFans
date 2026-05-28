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
