import { test, expect } from '@playwright/test';

test.describe('Telemetry Consent flow', () => {
    test('should display banner on first visit, allow accepting, and dismiss the banner', async ({ page }) => {
        // Navigate to homepage
        await page.goto('/');

        const bannerText = page.locator('text=We use continuous telemetry');
        await expect(bannerText).toBeVisible();

        const acceptBtn = page.locator('button:has-text("Accept")');
        await acceptBtn.click();

        await expect(bannerText).toBeHidden();

        // Reload the page, banner should remain absent
        await page.reload();
        await expect(bannerText).toBeHidden();

        // Check localStorage
        const consentValue = await page.evaluate(() => window.localStorage.getItem('telemetry_consent'));
        expect(consentValue).toBe('true');
    });

    test('should allow declining consent', async ({ page }) => {
        // Clear state before test starts by starting a new context (Playwright does this by default per test)
        await page.goto('/');

        const bannerText = page.locator('text=We use continuous telemetry');
        await expect(bannerText).toBeVisible();

        const declineBtn = page.locator('button:has-text("Decline")');
        await declineBtn.click();

        await expect(bannerText).toBeHidden();

        const consentValue = await page.evaluate(() => window.localStorage.getItem('telemetry_consent'));
        expect(consentValue).toBe('false');
    });
});
